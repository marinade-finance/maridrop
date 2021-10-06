use anchor_lang::{prelude::*, solana_program::system_program};
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

use crate::{error::ErrorCode, treasury::Treasury};

#[account] // one per user, gift for the user
#[derive(Debug, Default)]
pub struct Promise {
    pub target_authority: Pubkey, // user's pubkey
    pub treasury_account: Pubkey, // main state
    pub total_amount: u64,        // gift amount
    pub non_claimed_amount: u64,
}

impl Promise {
    pub const ACCOUNT_SEED: &'static [u8] = b"promise";
}

#[derive(Accounts)]
#[instruction(target_authority: Pubkey, bump: u8)]
pub struct InitPromise<'info> {
    #[account(mut, has_one = admin_authority, has_one = token_store)]
    pub treasury_account: Account<'info, Treasury>,
    pub admin_authority: Signer<'info>,
    #[account(init, payer = rent_payer, seeds = [
        Promise::ACCOUNT_SEED,
        &treasury_account.key().to_bytes(),
        &target_authority.to_bytes()],
        bump = bump)]
    pub promise_account: Account<'info, Promise>,
    pub token_store: Account<'info, TokenAccount>,
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitPromise<'info> {
    pub fn process(&mut self, target_authority: Pubkey) -> ProgramResult {
        *self.promise_account = Promise {
            target_authority,
            treasury_account: self.treasury_account.key(),
            total_amount: 0,
            non_claimed_amount: 0,
        };

        self.treasury_account.promise_count += 1;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetPromiseAmount<'info> {
    #[account(mut, has_one = treasury_account)]
    pub promise_account: Account<'info, Promise>,
    #[account(mut, has_one = admin_authority, has_one = token_store)]
    pub treasury_account: Account<'info, Treasury>,
    pub token_store: Account<'info, TokenAccount>,
    pub admin_authority: Signer<'info>,
}

impl<'info> SetPromiseAmount<'info> {
    pub fn process(&mut self, new_total_amount: u64) -> ProgramResult {
        if Clock::get()?.unix_timestamp >= self.treasury_account.start_time
            && new_total_amount < self.promise_account.total_amount
        {
            return Err(ErrorCode::CanNotWithdrawPromiseAfterStart.into());
        }
        let claimed_amount =
            self.promise_account.total_amount - self.promise_account.non_claimed_amount;
        if new_total_amount < claimed_amount {
            // Must be unreachable
            return Err(ErrorCode::CanNotWithdrawPromiseAfterStart.into());
        }
        let new_non_claimed = new_total_amount - claimed_amount;
        self.treasury_account.total_promised = (self.treasury_account.total_promised
            + new_total_amount)
            .saturating_sub(self.promise_account.total_amount);
        let new_total_non_claimed = (self.treasury_account.total_non_claimed + new_non_claimed)
            .saturating_sub(self.promise_account.non_claimed_amount);
        if new_total_non_claimed > self.token_store.amount {
            return Err(ErrorCode::InsufficientPromiseFunds.into());
        }
        self.treasury_account.total_non_claimed = new_total_non_claimed;

        self.promise_account.total_amount = new_total_amount;
        self.promise_account.non_claimed_amount = new_non_claimed;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = target_authority, has_one = treasury_account)]
    pub promise_account: Account<'info, Promise>,
    #[account(mut, has_one = token_store)]
    pub treasury_account: Account<'info, Treasury>,
    pub target_authority: Signer<'info>,
    #[account(seeds = [
        Treasury::TOKEN_AUTHORITY_SEED,
        &treasury_account.key().to_bytes()],
       bump = treasury_account.token_authority_bump)]
    pub token_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_store: Account<'info, TokenAccount>,
    #[account(mut)]
    pub transfer_token_to: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Claim<'info> {
    pub fn process(&mut self) -> ProgramResult {
        if Clock::get()?.unix_timestamp < self.treasury_account.start_time {
            return Err(ErrorCode::NonStarted.into());
        }

        let amount = self.promise_account.non_claimed_amount;
        transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.token_store.to_account_info(),
                    to: self.transfer_token_to.to_account_info(),
                    authority: self.token_authority.to_account_info(),
                },
                &[&[
                    Treasury::TOKEN_AUTHORITY_SEED,
                    &self.treasury_account.key().to_bytes(),
                    &[self.treasury_account.token_authority_bump],
                ]],
            ),
            amount,
        )?;
        self.promise_account.non_claimed_amount = 0;
        self.treasury_account.total_non_claimed = self
            .treasury_account
            .total_non_claimed
            .saturating_sub(amount);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ClosePromise<'info> {
    #[account(mut, has_one = treasury_account)]
    pub promise_account: Account<'info, Promise>,
    #[account(mut, has_one = admin_authority)]
    pub treasury_account: Account<'info, Treasury>,
    pub admin_authority: Signer<'info>,
    #[account(mut, owner = system_program::ID)]
    pub rent_collector: UncheckedAccount<'info>,
}

impl<'info> ClosePromise<'info> {
    pub fn process(&mut self) -> ProgramResult {
        if Clock::get()?.unix_timestamp < self.treasury_account.end_time {
            return Err(ErrorCode::TooEarlyToClose.into());
        }

        self.treasury_account.total_non_claimed = self
            .treasury_account
            .total_non_claimed
            .saturating_sub(self.promise_account.non_claimed_amount);
        // Cancel promise
        self.treasury_account.total_promised = self
            .treasury_account
            .total_promised
            .saturating_sub(self.promise_account.total_amount);

        self.treasury_account.promise_count = self.treasury_account.promise_count.saturating_sub(1);

        // while solana does not kill account
        self.promise_account.non_claimed_amount = 0;
        self.promise_account.total_amount = 0;
        **self.rent_collector.lamports.as_ref().borrow_mut() +=
            self.promise_account.to_account_info().lamports();
        **self
            .promise_account
            .to_account_info()
            .lamports
            .as_ref()
            .borrow_mut() = 0;
        Ok(())
    }
}
