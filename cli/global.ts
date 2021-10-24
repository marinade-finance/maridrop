import * as anchor from '@project-serum/anchor';
import {PublicKey} from '@solana/web3.js';
import {Command} from 'commander';
import fs from 'mz/fs';
const expandTilde = require('expand-tilde');
// eslint-disable-next-line node/no-unpublished-import
import * as maridropIdl from '../target/idl/maridrop.json';

export const MARIDROP_PROGRAM_ID = new anchor.web3.PublicKey(
  'mrdpo5HyUm6ajvGJzBDjLTsNM41cb9hXzZq5L5WXy9z'
);

export let connection: anchor.web3.Connection | undefined;
export let walletKeypair: anchor.web3.Keypair | undefined;
export let wallet: anchor.Wallet | undefined;
export let anchorProvider: anchor.Provider | undefined;
export let maridropProgram: anchor.Program | undefined;

export async function setup(command: Command) {
  connection = new anchor.web3.Connection(
    anchor.web3.clusterApiUrl(command.opts().cluster),
    command.opts().commitment
  );

  walletKeypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(
        await fs.readFile(expandTilde(command.opts().keypair), 'utf-8')
      )
    )
  );

  wallet = new anchor.Wallet(walletKeypair);

  anchorProvider = new anchor.Provider(
    connection,
    wallet,
    anchor.Provider.defaultOptions()
  );

  maridropProgram = new anchor.Program(
    maridropIdl as anchor.Idl,
    MARIDROP_PROGRAM_ID,
    anchorProvider
  );
}

export async function parseKeypair(str: string) {
  return anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(await fs.readFile(expandTilde(str), 'utf-8')))
  );
}

export async function parsePubkey(str: string): Promise<PublicKey> {
  try {
    return new PublicKey(str);
  } catch (e) {
    return (await parseKeypair(str)).publicKey;
  }
}
/*
// From anchor code
function accountDiscriminator(name: string): Buffer {
  return Buffer.from(anchor.utils.sha256.hash(`account:${name}`)).slice(0, 8);
}*/

export async function getAllPromises(treasury: anchor.web3.PublicKey) {
  return maridropProgram!.account.promise.all(Buffer.from(treasury.toBytes()));
}
