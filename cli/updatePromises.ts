import {Command} from 'commander';
import * as anchor from '@project-serum/anchor';
import fs from 'mz/fs';
import {Keypair, LAMPORTS_PER_SOL, PublicKey} from '@solana/web3.js';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import {TextEncoder} from 'util';
import * as token from '@solana/spl-token';
import * as _ from 'lodash';
import {
  anchorProvider,
  maridropProgram,
  parseKeypair,
  parsePubkey,
  walletKeypair,
} from './global';
const expandTilde = require('expand-tilde');

export async function updatePromises(
  treasury: string,
  inputs: string[],
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
  const inputJSONs = (
    await Promise.all(
      inputs.map(input => fs.readFile(expandTilde(input), 'utf-8'))
    )
  ).map(input => JSON.parse(input));
  const resultJSON: Record<string, number> = {};
  for (const inputJSON of inputJSONs) {
    _.mergeWith(resultJSON, inputJSON, (a, b) => (a || 0) + (b || 0));
  }

  const adminAuthority = admin ? await parseKeypair(admin) : walletKeypair!;
  if (!adminAuthority.publicKey.equals(treasuryAccount.adminAuthority)) {
    throw new Error(
      `Wrong admin ${adminAuthority.publicKey}. Expected ${treasuryAccount.adminAuthority}`
    );
  }

  let userBatch: string[] = [];
  const changedPromises: {
    promiseAddress: anchor.web3.PublicKey;
    amount: anchor.BN;
  }[] = [];
  const addedPromises: {
    promiseAddress: [anchor.web3.PublicKey, number];
    user: anchor.web3.PublicKey;
  }[] = [];

  const readUserBatch = async () => {
    const promiseAddresses = await Promise.all(
      userBatch.map(
        async user =>
          await anchor.web3.PublicKey.findProgramAddress(
            [
              new TextEncoder().encode('promise'),
              treasuryPubkey.toBytes(),
              new anchor.web3.PublicKey(user).toBytes(),
            ],
            maridropProgram!.programId
          )
      )
    );
    const promises = await maridropProgram!.account.promise.fetchMultiple(
      promiseAddresses.map(p => p[0])
    );
    for (let i = 0; i < userBatch.length; i++) {
      if (!promises[i]) {
        addedPromises.push({
          promiseAddress: promiseAddresses[i],
          user: new anchor.web3.PublicKey(userBatch[i]),
        });
      }

      if (
        (!promises[i] && resultJSON[userBatch[i]] > 0) ||
        (promises[i] &&
          !(promises[i] as any).totalAmount.eq(
            new anchor.BN(resultJSON[userBatch[i]] * LAMPORTS_PER_SOL)
          ))
      ) {
        changedPromises.push({
          promiseAddress: promiseAddresses[i][0],
          amount: new anchor.BN(resultJSON[userBatch[i]] * LAMPORTS_PER_SOL),
        });
      }
    }
    userBatch = [];
  };

  for (const user in resultJSON) {
    userBatch.push(user);
    if (userBatch.length > 64) {
      await readUserBatch();
    }
  }
  if (userBatch.length > 0) {
    await readUserBatch();
  }

  if (simulate) {
    console.log('TODO: simulate');
  } else {
    for (let i = 0; i < addedPromises.length; i += 5) {
      const tx = new anchor.web3.Transaction({
        feePayer: walletKeypair!.publicKey,
      });
      for (const promise of addedPromises.slice(i, i + 5)) {
        tx.add(
          maridropProgram!.instruction.initPromise(
            promise.user,
            promise.promiseAddress[1],
            {
              accounts: {
                treasuryAccount: treasury,
                adminAuthority: adminAuthority.publicKey,
                promiseAccount: promise.promiseAddress[0],
                tokenStore: treasuryAccount.tokenStore,
                rentPayer: walletKeypair!.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
              },
            }
          )
        );
      }
      console.log(
        `Add promises: ${await anchorProvider!.send(tx, [adminAuthority])}`
      );
    }

    for (let i = 0; i < changedPromises.length; i += 5) {
      const tx = new anchor.web3.Transaction({
        feePayer: walletKeypair!.publicKey,
      });
      for (const promise of changedPromises.slice(i, i + 5)) {
        tx.add(
          maridropProgram!.instruction.setPromiseAmount(promise.amount, {
            accounts: {
              promiseAccount: promise.promiseAddress,
              treasuryAccount: treasuryPubkey,
              tokenStore: treasuryAccount.tokenStore,
              adminAuthority: adminAuthority.publicKey,
            },
          })
        );
      }
      console.log(
        `Change promises: ${await anchorProvider!.send(tx, [adminAuthority])}`
      );
    }
  }
}
