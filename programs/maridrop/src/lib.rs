use anchor_lang::prelude::*;

pub mod error;
pub mod promise;
pub mod treasury;

use crate::promise::*;
use crate::treasury::*;

declare_id!("AaKhDmJu1rD23TL9qkoP9MzsK5agmcUcFRkthMV9643g");

#[program]
pub mod maridrop {
    use super::*;

    use vipers::validate::Validate;

    #[access_control(ctx.accounts.validate(token_authority_bump))]
    pub fn init_treasury(
        ctx: Context<InitTreasury>,
        admin_authority: Pubkey,
        rent_collector: Pubkey,
        start_time: i64,
        end_time: i64,
        token_authority_bump: u8,
    ) -> ProgramResult {
        ctx.accounts.process(
            admin_authority,
            rent_collector,
            start_time,
            end_time,
            token_authority_bump,
        )
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_treasury(ctx: Context<CloseTreasury>) -> ProgramResult {
        ctx.accounts.process()
    }

    #[access_control(ctx.accounts.validate(amount))]
    pub fn init_promise(
        ctx: Context<InitPromise>,
        target_authority: Pubkey,
        amount: u64,
        bump: u8,
    ) -> ProgramResult {
        ctx.accounts.process(target_authority, amount)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim(ctx: Context<Claim>) -> ProgramResult {
        ctx.accounts.process()
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_promise(ctx: Context<ClosePromise>) -> ProgramResult {
        ctx.accounts.process()
    }
}
