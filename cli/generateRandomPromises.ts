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

export async function generateRandomPromises(
  output: string,
  keypairs: string,
  {
    minAmount,
    maxAmount,
    totalAmount,
  }: {
    minAmount: string;
    maxAmount: string;
    totalAmount: string;
  }
) {
  let amountLeft = parseFloat(totalAmount);
  const minAmountNumber = parseFloat(minAmount);
  const maxAmountNumber = parseFloat(maxAmount);
  const users: Record<string, number> = {};
  const userKeypairs: Record<string, number[]> = {};
  const generateUser = (amount: number) => {
    const keypair = new anchor.web3.Keypair();
    users[keypair.publicKey.toBase58()] = amount;
    userKeypairs[keypair.publicKey.toBase58()] = Array.from(keypair.secretKey);
    amountLeft -= amount;
  };
  while (amountLeft > minAmountNumber) {
    generateUser(
      minAmountNumber + Math.random() * (maxAmountNumber - minAmountNumber)
    );
  }
  if (amountLeft > 0) {
    generateUser(amountLeft);
  }

  await fs.writeFile(expandTilde(output), JSON.stringify(users));
  await fs.writeFile(expandTilde(keypairs), JSON.stringify(userKeypairs));
}
