import { Command } from 'commander';
import * as anchor from '@project-serum/anchor';
import fs from 'mz/fs';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { TextEncoder } from 'util';
import * as token from '@solana/spl-token';
import {
  anchorProvider,
  maridropProgram,
  parseKeypair,
  parsePubkey,
  walletKeypair,
} from './global';
const expandTilde = require('expand-tilde');

export async function setPromiseAmount(
  treasury: string,
  user: string,
  amount: string,
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
  const userPubkey = new anchor.web3.PublicKey(user);
  const adminAuthority = admin ? await parseKeypair(admin) : walletKeypair!;
  if (!adminAuthority.publicKey.equals(treasuryAccount.adminAuthority)) {
    throw new Error(
      `Wrong admin ${adminAuthority.publicKey}. Expected ${treasuryAccount.adminAuthority}`
    );
  }

  const [promiseKey] = await anchor.web3.PublicKey.findProgramAddress(
    [
      new TextEncoder().encode('promise'),
      treasuryPubkey.toBytes(),
      userPubkey.toBytes(),
    ],
    maridropProgram!.programId
  );

  const amountBN = new anchor.BN(
    Math.round(parseFloat(amount) * LAMPORTS_PER_SOL)
  );
  if (simulate) {
    console.log(
      await maridropProgram!.simulate.setPromiseAmount(amountBN, {
        accounts: {
          promiseAccount: promiseKey,
          treasuryAccount: treasuryPubkey,
          tokenStore: treasuryAccount.tokenStore,
          adminAuthority: adminAuthority.publicKey,
        },
        signers: [adminAuthority],
      })
    );
  } else {
    console.log(
      await maridropProgram!.rpc.setPromiseAmount(amountBN, {
        accounts: {
          promiseAccount: promiseKey,
          treasuryAccount: treasuryPubkey,
          tokenStore: treasuryAccount.tokenStore,
          adminAuthority: adminAuthority.publicKey,
        },
        signers: [adminAuthority],
      })
    );
  }
}
