import { Command } from 'commander';
import * as anchor from '@project-serum/anchor';
import fs from 'mz/fs';
import { Keypair, PublicKey } from '@solana/web3.js';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { TextEncoder } from 'util';
import * as token from '@solana/spl-token';
import {
  anchorProvider,
  connection,
  getAllPromises,
  maridropProgram,
  parseKeypair,
  parsePubkey,
  walletKeypair,
} from './global';
const expandTilde = require('expand-tilde');

export async function setStartTime(
  treasury: string,
  startTime: string,
  {
    admin,
    simulate,
  }: {
    admin?: string;
    simulate: boolean;
  }
) {
  const treasuryPubkey = await parsePubkey(treasury);
  const treasuryAccount = await maridropProgram!.account.treasury.fetch(
    treasuryPubkey
  );
  const adminAuthority = admin ? await parseKeypair(admin) : walletKeypair!;
  if (!adminAuthority.publicKey.equals(treasuryAccount.adminAuthority)) {
    throw new Error(
      `Wrong admin ${adminAuthority.publicKey}. Expected ${treasuryAccount.adminAuthority}`
    );
  }
  const startDate = Date.parse(startTime);

  const startTs = startDate
    ? new anchor.BN(Math.round(startDate / 1000))
    : new anchor.BN(startTime || 0);

  console.log(`Set start time to ${startTs.isZero()? "-": new Date(startTs.toNumber() * 1000)}`)

  if (simulate) {
    console.log(
      await maridropProgram!.simulate.setStartTime(startTs, {
        accounts: {
          treasuryAccount: treasury,
          adminAuthority: adminAuthority.publicKey,
        },
        signers: [adminAuthority],
      })
    );
  } else {
    console.log(
      await maridropProgram!.rpc.setStartTime(startTs, {
        accounts: {
          treasuryAccount: treasury,
          adminAuthority: adminAuthority.publicKey,
        },
        signers: [adminAuthority],
      })
    );
  }
}
