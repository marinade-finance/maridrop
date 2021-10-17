import {Command} from 'commander';
import * as anchor from '@project-serum/anchor';
import fs from 'mz/fs';
import {Keypair, PublicKey} from '@solana/web3.js';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import {TextEncoder} from 'util';
import * as token from '@solana/spl-token';
import {
  anchorProvider,
  connection,
  maridropProgram,
  parseKeypair,
  parsePubkey,
  walletKeypair,
} from './global';
const expandTilde = require('expand-tilde');

export async function createTreasury({
  admin,
  treasury,
  tokenStore,
  tokenMint,
  startTime,
  endTime,
  simulate,
}: {
  admin?: string;
  treasury?: string;
  tokenStore?: string;
  tokenMint: string;
  startTime?: Date;
  endTime?: Date;
  simulate: boolean;
}) {
  const treasuryKeypair = treasury
    ? await parseKeypair(treasury)
    : new Keypair();
  console.log(`Treasury ${treasuryKeypair.publicKey.toBase58()}`);
  const tokenStoreKeypair = tokenStore
    ? await parseKeypair(tokenStore)
    : new Keypair();
  console.log(`Token store: ${tokenStoreKeypair.publicKey.toBase58()}`);
  const tokenMintPubkey = await parsePubkey(tokenMint);
  const adminAuthority = admin
    ? await parsePubkey(admin)
    : anchorProvider!.wallet.publicKey;
  const [tokenStoreAuthority] = await anchor.web3.PublicKey.findProgramAddress(
    [new TextEncoder().encode('treasury'), treasuryKeypair.publicKey.toBytes()],
    maridropProgram!.programId
  );

  const transaction = new anchor.web3.Transaction({
    feePayer: walletKeypair!.publicKey,
  });

  transaction.add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: walletKeypair!.publicKey,
      newAccountPubkey: tokenStoreKeypair.publicKey,
      lamports: await token.Token.getMinBalanceRentForExemptAccount(
        connection!
      ),
      space: token.AccountLayout.span,
      programId: token.TOKEN_PROGRAM_ID,
    })
  );

  transaction.add(
    token.Token.createInitAccountInstruction(
      token.TOKEN_PROGRAM_ID,
      tokenMintPubkey,
      tokenStoreKeypair.publicKey,
      tokenStoreAuthority
    )
  );

  transaction.add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: maridropProgram!.provider.wallet.publicKey,
      newAccountPubkey: treasuryKeypair.publicKey,
      lamports: await connection!.getMinimumBalanceForRentExemption(1000),
      space: 1000,
      programId: maridropProgram!.programId,
    })
  );

  const startTs = startTime
    ? new anchor.BN(Math.round(new Date(startTime).getTime() / 1000))
    : new anchor.BN(0);

  const endTs = endTime
    ? new anchor.BN(Math.round(new Date(endTime).getTime() / 1000))
    : new anchor.BN(0);

  transaction.add(
    await maridropProgram!.instruction.initTreasury(
      adminAuthority,
      startTs,
      endTs,
      {
        accounts: {
          treasuryAccount: treasuryKeypair.publicKey,
          tokenStore: tokenStoreKeypair.publicKey,
        },
      }
    )
  );
  if (simulate) {
    console.log(
      anchorProvider!.simulate(transaction, [
        treasuryKeypair,
        tokenStoreKeypair,
      ])
    );
  } else {
    console.log(
      `Create treasury: ${await anchorProvider!.send(transaction, [
        treasuryKeypair,
        tokenStoreKeypair,
      ])}`
    );
  }

  return {
    treasury: treasuryKeypair.publicKey,
    tokenStore: tokenStoreKeypair.publicKey,
    admin: adminAuthority,
  };
}
