use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Treasury token authority does not match")]
    TreasuryTokenAuthorityDoesNotMatch,
    #[msg("Treasury token account must not be delegated")]
    TreasuryTokenAccountMustNotBeDelegated,
    #[msg("Treasury token account must not be closeable")]
    TreasuryTokenAccountMustNotBeCloseable,
    #[msg("Can not close treasury while it has not closed promises")]
    ClosingTreasuryWithPromises,
    #[msg("Can not close by moving tokens to the same account")]
    CloseTargetIsSource,
    #[msg("Insufficient funds to make this promise")]
    InsufficientPromiseFunds,
    #[msg("Airdrop is not started yet")]
    NonStarted,
}
