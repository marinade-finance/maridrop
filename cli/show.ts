import { Command } from 'commander';
import * as anchor from '@project-serum/anchor';
import { maridropProgram, parsePubkey } from './global';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getMintInfo, getTokenAccountInfo, withDecimals } from './helpers/anchor-spl-token-helper';

export async function showTreasury(treasury: string) {
  const treasuryPubkey = await parsePubkey(treasury);
  const treasuryAccount = await maridropProgram!.account.treasury.fetch(
    treasuryPubkey
  );
  console.log(`Treasury ${treasury}`);
  console.log(`Admin ${treasuryAccount.adminAuthority.toBase58()}`);
  console.log(`Token store ${treasuryAccount.tokenStore.toBase58()}`);
  const tokenStoreInfo = await getTokenAccountInfo(
    maridropProgram!.provider,
    treasuryAccount.tokenStore
  );
  const mintInfo = await getMintInfo(
    maridropProgram!.provider,
    tokenStoreInfo.mint
  );
  console.log("Mint", tokenStoreInfo.mint.toBase58())
  console.log("Token store balance", withDecimals(tokenStoreInfo.amount, mintInfo.decimals));
  console.log(
    `Total promised ${treasuryAccount.totalPromised.toNumber() / LAMPORTS_PER_SOL
    }`
  );
  console.log(
    `Total not claimed ${treasuryAccount.totalNonClaimed.toNumber() / LAMPORTS_PER_SOL
    }`
  );
  console.log(`Promise count ${treasuryAccount.promiseCount.toNumber()}`);
  console.log(`Start time ${new Date(treasuryAccount.startTime.toNumber() * 1000)}`);
}
