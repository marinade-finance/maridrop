use anchor_lang::{prelude::*, solana_program::{system_program, clock::UnixTimestamp}};
use anchor_spl::token::{Token, transfer};
use anchor_spl::token::{close_account, CloseAccount, TokenAccount, Transfer};

use crate::error::ErrorCode;

#[account]

pub struct Treasury {
    pub admin_authority: Pubkey,
    pub token_store: Pubkey,    // where we store the token to be distributed
    pub rent_collector: Pubkey, // collect rent-free-lamports when closing accounts
    pub total_promised: u64,    // < token_store.amount, how much is promised now
    pub start_time: i64,        // Prevent claiming earlier
    pub end_time: i64,          // Can not close earlier
    pub token_authority_bump: u8,
}

impl Treasury {
    pub const TOKEN_AUTHORITY_SEED: &'static [u8] = b"treasury";
}

#[derive(Accounts)]
pub struct InitTreasury<'info> {
    #[account(zero, rent_exempt = enforce)]
    pub treasury_account: Account<'info, Treasury>,
    pub token_store: Account<'info, TokenAccount>,
}

impl<'info> InitTreasury<'info> {
    pub fn process(
        &mut self,
        admin_authority: Pubkey,
        rent_collector: Pubkey,
        start_time: UnixTimestamp,
        end_time: UnixTimestamp,
    ) -> ProgramResult {
        let (token_authority, token_authority_bump) = Pubkey::find_program_address(
            &[
                Treasury::TOKEN_AUTHORITY_SEED,
                &self.treasury_account.key().to_bytes(),
            ],
            &crate::ID,
        );

        if self.token_store.owner != token_authority {
            msg!(
                "Expected treasury token authority {}",
                token_authority
            );
            return Err(ErrorCode::TreasuryTokenAuthorityDoesNotMatch.into());
        }

        if self.token_store.delegate.is_some() {
            return Err(ErrorCode::TreasuryTokenAccountMustNotBeDelegated.into());
        }

        if self.token_store.close_authority.is_some() {
            return Err(ErrorCode::TreasuryTokenAccountMustNotBeCloseable.into());
        }

        *self.treasury_account = Treasury {
            admin_authority,
            token_store: self.token_store.key(),
            rent_collector,
            total_promised: 0,
            start_time,
            end_time,
            token_authority_bump,
        };
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CloseTreasury<'info> {
    #[account(mut, has_one = admin_authority, has_one = token_store, has_one = rent_collector)]
    pub treasury_account: Account<'info, Treasury>,
    pub admin_authority: Signer<'info>,
    #[account(seeds = [
        Treasury::TOKEN_AUTHORITY_SEED,
        &treasury_account.key().to_bytes()],
       bump = treasury_account.token_authority_bump)]
    pub token_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_store: Account<'info, TokenAccount>, // closes this account
    #[account(mut)]
    pub transfer_token_to: Account<'info, TokenAccount>,
    #[account(mut, owner = system_program::ID)]
    pub rent_collector: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> CloseTreasury<'info> {
    pub fn process(&mut self) -> ProgramResult {
        if Clock::get()?.unix_timestamp < self.treasury_account.end_time {
            return Err(ErrorCode::TooEarlyToClose.into());
        }

        if self.treasury_account.total_promised > 0 {
            return Err(ErrorCode::ClosingTreasuryWithPromises.into());
        }

        if self.transfer_token_to.key() == self.token_store.key() {
            return Err(ErrorCode::CloseTargetIsSource.into());
        }

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
            self.token_store.amount,
        )?;

        close_account(CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.token_store.to_account_info(),
                destination: self.rent_collector.to_account_info(),
                authority: self.token_authority.to_account_info(),
            },
            &[&[
                Treasury::TOKEN_AUTHORITY_SEED,
                &self.treasury_account.key().to_bytes(),
                &[self.treasury_account.token_authority_bump],
            ]],
        ))?;

        **self.rent_collector.lamports.as_ref().borrow_mut() +=
            self.treasury_account.to_account_info().lamports();
        **self
            .treasury_account
            .to_account_info()
            .lamports
            .as_ref()
            .borrow_mut() = 0;

        Ok(())
    }
}
