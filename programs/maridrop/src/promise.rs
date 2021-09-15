use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, TokenAccount, Transfer};
use vipers::validate::Validate;

use crate::{error::ErrorCode, treasury::Treasury};

#[account] // one per user, gift for the user
#[derive(Debug, Default)]
pub struct Promise {
    pub target_authority: Pubkey, // user's pubkey
    pub treasury_account: Pubkey, // main state
    pub amount: u64,              // gift amount
}

impl Promise {
    pub const ACCOUNT_SEED: &'static [u8] = b"promise";
}

#[derive(Accounts)]
#[instruction(target_authority: Pubkey, bump: u8)]
pub struct InitPromise<'info> {
    #[account(mut, has_one = admin_authority, has_one = token_store)]
    pub treasury_account: Account<'info, Treasury>,
    #[account(signer)]
    pub admin_authority: AccountInfo<'info>,
    #[account(init, payer = rent_payer, seeds = [
        Promise::ACCOUNT_SEED,
        &treasury_account.key().to_bytes(),
        &target_authority.to_bytes()],
        bump = bump)]
    pub promise_account: Account<'info, Promise>,
    pub token_store: Account<'info, TokenAccount>,
    #[account(mut, signer)]
    pub rent_payer: AccountInfo<'info>,

    #[account(address = vipers::program_ids::system::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> InitPromise<'info> {
    pub fn validate(&self, amount: u64) -> ProgramResult {
        if self.treasury_account.total_promised + amount > self.token_store.amount {
            return Err(ErrorCode::InsufficientPromiseCreationFunds.into());
        }

        Ok(())
    }

    pub fn process(&mut self, target_authority: Pubkey, amount: u64) -> ProgramResult {
        *self.promise_account = Promise {
            target_authority,
            treasury_account: self.treasury_account.key(),
            amount,
        };

        self.treasury_account.total_promised += amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = target_authority, has_one = treasury_account)]
    pub promise_account: Account<'info, Promise>,
    #[account(mut, has_one = token_store, has_one = rent_collector)]
    pub treasury_account: Account<'info, Treasury>,
    #[account(signer)]
    pub target_authority: AccountInfo<'info>,
    #[account(seeds = [
        Treasury::TOKEN_AUTHORITY_SEED,
        &treasury_account.key().to_bytes()],
       bump = treasury_account.token_authority_bump)]
    pub token_authority: AccountInfo<'info>,
    #[account(mut)]
    pub token_store: Account<'info, TokenAccount>,
    #[account(mut)]
    pub transfer_token_to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub rent_collector: AccountInfo<'info>,

    #[account(address = vipers::program_ids::token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> Validate<'info> for Claim<'info> {
    fn validate(&self) -> ProgramResult {
        if Clock::get()?.unix_timestamp < self.treasury_account.start_time {
            return Err(ErrorCode::NonStarted.into());
        }

        Ok(())
    }
}

impl<'info> Claim<'info> {
    pub fn process(&mut self) -> ProgramResult {
        transfer(
            CpiContext::new_with_signer(
                self.token_program.clone(),
                Transfer {
                    from: self.token_store.to_account_info(),
                    to: self.transfer_token_to.to_account_info(),
                    authority: self.token_authority.clone(),
                },
                &[&[
                    Treasury::TOKEN_AUTHORITY_SEED,
                    &self.treasury_account.key().to_bytes(),
                    &[self.treasury_account.token_authority_bump],
                ]],
            ),
            self.promise_account.amount,
        )?;
        self.treasury_account.total_promised = self
            .treasury_account
            .total_promised
            .saturating_sub(self.promise_account.amount);

        self.promise_account.amount = 0;
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

#[derive(Accounts)]
pub struct ClosePromise<'info> {
    #[account(mut, has_one = treasury_account)]
    pub promise_account: ProgramAccount<'info, Promise>,
    #[account(mut, has_one = admin_authority, has_one = rent_collector)]
    pub treasury_account: ProgramAccount<'info, Treasury>,
    #[account(signer)]
    pub admin_authority: AccountInfo<'info>,
    #[account(mut)]
    pub rent_collector: AccountInfo<'info>,
}

impl<'info> Validate<'info> for ClosePromise<'info> {
    fn validate(&self) -> ProgramResult {
        if Clock::get()?.unix_timestamp < self.treasury_account.end_time {
            return Err(ErrorCode::TooEarlyToClose.into());
        }

        Ok(())
    }
}

impl<'info> ClosePromise<'info> {
    pub fn process(&mut self) -> ProgramResult {
        self.treasury_account.total_promised = self
            .treasury_account
            .total_promised
            .saturating_sub(self.promise_account.amount);

        self.promise_account.amount = 0;
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
