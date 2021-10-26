import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { BN } from '@project-serum/anchor';

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token as TokenProgramClass,
} from '@solana/spl-token';
import { MintInfo, AccountInfo as TokenAccountInfo, AccountLayout } from '@solana/spl-token';

// u64 is BN + fromBuffer() & toBuffer() to decode/encode LittleEndian
// can be treated as BN
import { u64 } from '@solana/spl-token';

export { MintInfo, TokenAccountInfo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };

export function withDecimals(rawAmount: u64, decimals: number): number {
  return rawAmount.toNumber() / (10 ** decimals)
}

export async function getTokenAccountInfo(
  provider: anchor.Provider,
  address: web3.PublicKey,
  commitment?: web3.Commitment,
): Promise<TokenAccountInfo> {
  const info = await provider.connection.getAccountInfo(address, commitment);

  if (info === null) {
    throw new Error("FAILED_TO_FIND_ACCOUNT");
  }

  if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("expected program-owner to be TOKEN_PROGRAM_ID");
  }

  if (info.data.length !== AccountLayout.span) {
    throw new Error('Invalid account size');
  }

  const accountInfo = AccountLayout.decode(info.data);
  accountInfo.address = address;
  accountInfo.mint = new web3.PublicKey(accountInfo.mint);
  accountInfo.owner = new web3.PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  if (accountInfo.delegateOption === 0) {
    accountInfo.delegate = null;
    accountInfo.delegatedAmount = new BN(0);
  } else {
    accountInfo.delegate = new web3.PublicKey(accountInfo.delegate);
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  accountInfo.isInitialized = accountInfo.state !== 0;
  accountInfo.isFrozen = accountInfo.state === 2;

  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    accountInfo.isNative = true;
  } else {
    accountInfo.rentExemptReserve = null;
    accountInfo.isNative = false;
  }

  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null;
  } else {
    accountInfo.closeAuthority = new web3.PublicKey(
      accountInfo.closeAuthority
    );
  }

  return accountInfo;
}

/*
export async function getTokenAccountInfo2(
  provider: anchor.Provider,
  addr: web3.PublicKey,
  mintAddr: web3.PublicKey
): Promise<TokenAccountInfo> {
  const t = new Mint(
    provider.connection,
    mintAddr,
    TOKEN_PROGRAM_ID,
    new web3.Keypair()
  );
  return t.getAccountInfo(addr);
}
*/

export async function getMintInfo(
  provider: anchor.Provider,
  mintAddr: web3.PublicKey
): Promise<MintInfo> {
  const t = new TokenProgramClass(
    provider.connection,
    mintAddr,
    TOKEN_PROGRAM_ID,
    new web3.Keypair()
  );
  return t.getMintInfo();
}

export async function getAssociatedTokenAccount(
  mint: web3.PublicKey,
  owner: web3.PublicKey
): Promise<web3.PublicKey> {
  return anchor.utils.token.associatedAddress({ mint: mint, owner: owner });
}

/*export async function createAssociatedTokenAccount(
  provider: anchor.Provider,
  mint: web3.PublicKey,
  owner: web3.PublicKey
): Promise<web3.PublicKey> {
  const associated = await getAssociatedTokenAccount(mint, owner);

  try {
    const tokenAccountInfo = await getTokenAccount(provider, associated, mint);
    return associated; //if the account exists
  } catch {
    const tx = new anchor.web3.Transaction();

    tx.add(
      await Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        associated,
        owner,
        provider.wallet.publicKey
      )
    );

    await provider.send(tx, []);
  }
  return associated;
}
*/
