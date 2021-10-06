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

    pub fn init_treasury(
        ctx: Context<InitTreasury>,
        admin_authority: Pubkey,
        start_time: i64,
        end_time: i64,
    ) -> ProgramResult {
        ctx.accounts.process(
            admin_authority,
            start_time,
            end_time,
        )
    }

    pub fn close_treasury(ctx: Context<CloseTreasury>) -> ProgramResult {
        ctx.accounts.process()
    }

    pub fn init_promise(
        ctx: Context<InitPromise>,
        target_authority: Pubkey,
        _bump: u8, // for anchor macro use
    ) -> ProgramResult {
        ctx.accounts.process(target_authority)
    }

    pub fn set_promise_amount(
        ctx: Context<SetPromiseAmount>,
        new_total_amount: u64
    ) -> ProgramResult {
        ctx.accounts.process(new_total_amount)
    }

    pub fn claim(ctx: Context<Claim>) -> ProgramResult {
        ctx.accounts.process()
    }

    pub fn close_promise(ctx: Context<ClosePromise>) -> ProgramResult {
        ctx.accounts.process()
    }
}
