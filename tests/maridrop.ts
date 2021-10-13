// eslint-disable-next-line node/no-unsupported-features/node-builtins
import {TextEncoder} from 'util';
import * as token from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';

describe('maridrop', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const adminAuthority = new anchor.web3.Keypair();
  const mndeMint = new anchor.web3.Keypair();
  const tokenStore = new anchor.web3.Keypair();
  const program = anchor.workspace.Maridrop;

  before(async () => {
    const rentForMint = await token.Token.getMinBalanceRentForExemptMint(
      anchor.getProvider().connection
    );
    // input
    const transaction = new anchor.web3.Transaction({
      feePayer: anchor.getProvider().wallet.publicKey,
    });
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: anchor.getProvider().wallet.publicKey,
        newAccountPubkey: mndeMint.publicKey,
        lamports: rentForMint,
        space: token.MintLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      })
    );
    transaction.add(
      token.Token.createInitMintInstruction(
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        9,
        anchor.getProvider().wallet.publicKey,
        null
      )
    );
    console.log(
      'create mndeMint',
      await anchor.getProvider().send(transaction, [mndeMint])
    );
  });

  async function initialize(treasury: anchor.web3.Keypair) {
    const [tokenStoreAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
        program.programId
      );

    const transaction = new anchor.web3.Transaction({
      feePayer: anchor.getProvider().wallet.publicKey,
    });

    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: anchor.getProvider().wallet.publicKey,
        newAccountPubkey: tokenStore.publicKey,
        lamports: await token.Token.getMinBalanceRentForExemptAccount(
          anchor.getProvider().connection
        ),
        space: token.AccountLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      })
    );

    transaction.add(
      token.Token.createInitAccountInstruction(
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        tokenStore.publicKey,
        tokenStoreAuthority
      )
    );

    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: treasury.publicKey,
        lamports:
          await program.provider.connection.getMinimumBalanceForRentExemption(
            1000
          ),
        space: 1000,
        programId: program.programId,
      })
    );

    transaction.add(
      await program.instruction.initTreasury(
        adminAuthority.publicKey,
        new anchor.BN(0),
        new anchor.BN(0),
        {
          accounts: {
            treasuryAccount: treasury.publicKey,
            tokenStore: tokenStore.publicKey,
          },
        }
      )
    );
    console.log(
      'Init: ' +
        (await program.provider.send(transaction, [treasury, tokenStore]))
    );
  }

  it('Is initialized!', async () => {
    const treasury = new anchor.web3.Keypair();
    await initialize(treasury);
  });
});
