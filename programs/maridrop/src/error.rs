use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Invalid treasury token authority bump")]
    InvalidTreasuryTokenAuthorityBump,
    #[msg("Treasury token authority does not match")]
    TreasuryTokenAuthorityDoesNotMatch,
    #[msg("Treasury token account can not be delegated")]
    TreasuryTokenAccountCanNotBeDelegated,
    #[msg("Too early to close")]
    TooEarlyToClose,
    #[msg("Can not close treasury while it has not closed promises")]
    ClosingTreasuryWithPromises,
    #[msg("Can not close by moving tokens to the same account")]
    CloseTargetIsSource,
    #[msg("Insufficient funds to make this promise")]
    InsufficientPromiseCreationFunds,
    #[msg("Airdrop is not started yet")]
    NonStarted,
}
