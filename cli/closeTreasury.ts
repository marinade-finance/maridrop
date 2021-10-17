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

export async function closeTreasury(
  treasury: string,
  {
    admin,
    tokenMint,
    simulate,
  }: {
    admin?: string;
    tokenMint: string; // TODO read from tokenStore
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
  const tokenMintAddress = new anchor.web3.PublicKey(tokenMint);

  const myTokenAccount = await token.Token.getAssociatedTokenAddress(
    token.ASSOCIATED_TOKEN_PROGRAM_ID,
    token.TOKEN_PROGRAM_ID,
    tokenMintAddress,
    walletKeypair!.publicKey
  );
  if (!(await connection!.getAccountInfo(myTokenAccount))) {
    // TODO
    throw new Error('Create target account first');
  }

  const [tokenStoreAuthority] = await anchor.web3.PublicKey.findProgramAddress(
    [new TextEncoder().encode('treasury'), treasuryPubkey.toBytes()],
    maridropProgram!.programId
  );

  if (simulate) {
    console.log(
      await maridropProgram!.simulate.closeTreasury({
        accounts: {
          treasuryAccount: treasury,
          adminAuthority: adminAuthority.publicKey,
          tokenAuthority: tokenStoreAuthority,
          tokenStore: treasuryAccount.tokenStore,
          transferTokenTo: myTokenAccount,
          rentCollector: walletKeypair!.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        },
        signers: [adminAuthority],
      })
    );
  } else {
    console.log(
      await maridropProgram!.rpc.closeTreasury({
        accounts: {
          treasuryAccount: treasury,
          adminAuthority: adminAuthority.publicKey,
          tokenAuthority: tokenStoreAuthority,
          tokenStore: treasuryAccount.tokenStore,
          transferTokenTo: myTokenAccount,
          rentCollector: walletKeypair!.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        },
        signers: [adminAuthority],
      })
    );
  }
}
