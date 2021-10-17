import {Command} from 'commander';
import * as anchor from '@project-serum/anchor';
import {maridropProgram, parsePubkey} from './global';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

export async function showTreasury(treasury: string) {
  const treasuryPubkey = await parsePubkey(treasury);
  const treasuryAccount = await maridropProgram!.account.treasury.fetch(
    treasuryPubkey
  );
  console.log(`Treasury ${treasury}`);
  console.log(`Admin ${treasuryAccount.adminAuthority.toBase58()}`);
  console.log(`Token store ${treasuryAccount.tokenStore.toBase58()}`);
  console.log(
    `Total promised ${
      treasuryAccount.totalPromised.toNumber() / LAMPORTS_PER_SOL
    }`
  );
  console.log(
    `Total not claimed ${
      treasuryAccount.totalNonClaimed.toNumber() / LAMPORTS_PER_SOL
    }`
  );
  console.log(`Promise count ${treasuryAccount.promiseCount.toNumber()}`);
  console.log(`Start time ${treasuryAccount.startTime.toNumber()}`);
  console.log(`End time ${treasuryAccount.endTime.toNumber()}`);
}
