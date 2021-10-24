// eslint-disable-next-line node/no-unsupported-features/node-builtins
import {TextEncoder} from 'util';
import * as token from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
// eslint-disable-next-line node/no-unpublished-import
import * as chai from 'chai';

describe('maridrop', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // const adminAuthority = new anchor.web3.Keypair();
  const mndeMint = new anchor.web3.Keypair();
  let myMndeAccount: anchor.web3.PublicKey | undefined;
  const program = anchor.workspace.Maridrop;

  before(async () => {
    myMndeAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
      token.TOKEN_PROGRAM_ID,
      mndeMint.publicKey,
      anchor.getProvider().wallet.publicKey
    );

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
    transaction.add(
      token.Token.createAssociatedTokenAccountInstruction(
        token.ASSOCIATED_TOKEN_PROGRAM_ID,
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        myMndeAccount,
        anchor.getProvider().wallet.publicKey,
        anchor.getProvider().wallet.publicKey
      )
    );

    console.log(
      `Preape mnde mint ${mndeMint.publicKey}: ${await anchor
        .getProvider()
        .send(transaction, [mndeMint])}`
    );
  });

  async function createTreasury(
    adminAuthority: anchor.web3.Keypair,
    treasury: anchor.web3.Keypair,
    tokenStore: anchor.web3.Keypair,
    startTime?: Date
  ) {
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

    const startTs = startTime
      ? new anchor.BN(Math.round(startTime.getTime() / 1000))
      : new anchor.BN(0);

    transaction.add(
      await program.instruction.initTreasury(
        adminAuthority.publicKey,
        startTs,
        {
          accounts: {
            treasuryAccount: treasury.publicKey,
            tokenStore: tokenStore.publicKey,
          },
        }
      )
    );
    console.log(
      `Create treasury: ${await program.provider.send(transaction, [
        treasury,
        tokenStore,
      ])}`
    );
  }

  async function createPromise(
    adminAuthority: anchor.web3.Keypair,
    treasury: anchor.web3.PublicKey,
    tokenStore: anchor.web3.PublicKey,
    user: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> {
    const [promiseKey, promiseKeyBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          new TextEncoder().encode('promise'),
          treasury.toBytes(),
          user.toBytes(),
        ],
        program.programId
      );
    await program.rpc.initPromise(user, promiseKeyBump, {
      accounts: {
        treasuryAccount: treasury,
        adminAuthority: adminAuthority.publicKey,
        promiseAccount: promiseKey,
        tokenStore: tokenStore,
        rentPayer: anchor.getProvider().wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [adminAuthority],
    });

    return promiseKey;
  }

  async function mintFunds(tokenStore: anchor.web3.PublicKey, amount: number) {
    const mintTransaction = new anchor.web3.Transaction({
      feePayer: anchor.getProvider().wallet.publicKey,
    });
    mintTransaction.add(
      token.Token.createMintToInstruction(
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        tokenStore,
        anchor.getProvider().wallet.publicKey,
        [],
        amount
      )
    );
    await anchor.getProvider().send(mintTransaction);
  }

  it('Can create treasury', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
  });

  it('It can close empty treasury', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    const rentCollector = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);

    const [tokenStoreAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
        program.programId
      );

    await program.rpc.closeTreasury({
      accounts: {
        treasuryAccount: treasury.publicKey,
        adminAuthority: adminAuthority.publicKey,
        tokenAuthority: tokenStoreAuthority,
        tokenStore: tokenStore.publicKey,
        transferTokenTo: myMndeAccount,
        rentCollector: rentCollector.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
      signers: [adminAuthority],
    });
  });

  it('Can create promise', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const user = new anchor.web3.Keypair();
    const promiseKey = await createPromise(
      adminAuthority,
      treasury.publicKey,
      tokenStore.publicKey,
      user.publicKey
    );
  });

  it('Can not close treasury with promise', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const user = new anchor.web3.Keypair();
    const rentCollector = new anchor.web3.Keypair();
    const [tokenStoreAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
        program.programId
      );
    const promiseKey = await createPromise(
      adminAuthority,
      treasury.publicKey,
      tokenStore.publicKey,
      user.publicKey
    );
    try {
      await program.simulate.closeTreasury({
        accounts: {
          treasuryAccount: treasury.publicKey,
          adminAuthority: adminAuthority.publicKey,
          tokenAuthority: tokenStoreAuthority,
          tokenStore: tokenStore.publicKey,
          transferTokenTo: myMndeAccount,
          rentCollector: rentCollector.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        },
        signers: [adminAuthority],
      });
      chai.assert.fail('Treasury with promise was closed');
    } catch (e) {
      // OK must be here
    }
  });

  it('Can not increase promise without funds', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const user = new anchor.web3.Keypair();
    const promiseKey = await createPromise(
      adminAuthority,
      treasury.publicKey,
      tokenStore.publicKey,
      user.publicKey
    );
    try {
      await program.simulate.setPromiseAmount(
        new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL),
        {
          accounts: {
            promiseAccount: promiseKey,
            treasuryAccount: treasury.publicKey,
            tokenStore: tokenStore.publicKey,
            adminAuthority: adminAuthority.publicKey,
          },
          signers: [adminAuthority],
        }
      );
      chai.assert.fail('Non funded promise');
    } catch (e) {
      // OK
    }
  });

  it('Can increase promise with funds', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const user = new anchor.web3.Keypair();
    const promiseKey = await createPromise(
      adminAuthority,
      treasury.publicKey,
      tokenStore.publicKey,
      user.publicKey
    );

    await mintFunds(tokenStore.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    await program.rpc.setPromiseAmount(
      new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL),
      {
        accounts: {
          promiseAccount: promiseKey,
          treasuryAccount: treasury.publicKey,
          tokenStore: tokenStore.publicKey,
          adminAuthority: adminAuthority.publicKey,
        },
        signers: [adminAuthority],
      }
    );
  });

  it('User can claim promise', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const user = new anchor.web3.Keypair();

    const createUserAccountTransaction = new anchor.web3.Transaction({
      feePayer: anchor.getProvider().wallet.publicKey,
    });
    const userTokenAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
      token.TOKEN_PROGRAM_ID,
      mndeMint.publicKey,
      user.publicKey
    );
    createUserAccountTransaction.add(
      token.Token.createAssociatedTokenAccountInstruction(
        token.ASSOCIATED_TOKEN_PROGRAM_ID,
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        userTokenAccount,
        user.publicKey,
        anchor.getProvider().wallet.publicKey
      )
    );
    await anchor.getProvider().send(createUserAccountTransaction);

    const promiseKey = await createPromise(
      adminAuthority,
      treasury.publicKey,
      tokenStore.publicKey,
      user.publicKey
    );

    await mintFunds(tokenStore.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    await program.rpc.setPromiseAmount(
      new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL),
      {
        accounts: {
          promiseAccount: promiseKey,
          treasuryAccount: treasury.publicKey,
          tokenStore: tokenStore.publicKey,
          adminAuthority: adminAuthority.publicKey,
        },
        signers: [adminAuthority],
      }
    );

    const [tokenStoreAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
        program.programId
      );

    await program.rpc.claim({
      accounts: {
        promiseAccount: promiseKey,
        treasuryAccount: treasury.publicKey,
        targetAuthority: user.publicKey,
        tokenAuthority: tokenStoreAuthority,
        tokenStore: tokenStore.publicKey,
        transferTokenTo: userTokenAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
      signers: [user],
    });

    const userBalance = (
      await anchor
        .getProvider()
        .connection.getTokenAccountBalance(userTokenAccount)
    ).value.amount;
    chai.assert.equal(
      userBalance,
      new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL).toString()
    );
  });

  it('User can claim promise multiple times', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const user = new anchor.web3.Keypair();

    const createUserAccountTransaction = new anchor.web3.Transaction({
      feePayer: anchor.getProvider().wallet.publicKey,
    });
    const userTokenAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
      token.TOKEN_PROGRAM_ID,
      mndeMint.publicKey,
      user.publicKey
    );
    createUserAccountTransaction.add(
      token.Token.createAssociatedTokenAccountInstruction(
        token.ASSOCIATED_TOKEN_PROGRAM_ID,
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        userTokenAccount,
        user.publicKey,
        anchor.getProvider().wallet.publicKey
      )
    );
    await anchor.getProvider().send(createUserAccountTransaction);

    const promiseKey = await createPromise(
      adminAuthority,
      treasury.publicKey,
      tokenStore.publicKey,
      user.publicKey
    );

    const repeatCount = 3;

    await mintFunds(
      tokenStore.publicKey,
      repeatCount * 10 * anchor.web3.LAMPORTS_PER_SOL
    );

    for (let i = 0; i < repeatCount; i++) {
      await program.rpc.setPromiseAmount(
        new anchor.BN((i + 1) * 10 * anchor.web3.LAMPORTS_PER_SOL),
        {
          accounts: {
            promiseAccount: promiseKey,
            treasuryAccount: treasury.publicKey,
            tokenStore: tokenStore.publicKey,
            adminAuthority: adminAuthority.publicKey,
          },
          signers: [adminAuthority],
        }
      );

      const [tokenStoreAuthority] =
        await anchor.web3.PublicKey.findProgramAddress(
          [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
          program.programId
        );

      await program.rpc.claim({
        accounts: {
          promiseAccount: promiseKey,
          treasuryAccount: treasury.publicKey,
          targetAuthority: user.publicKey,
          tokenAuthority: tokenStoreAuthority,
          tokenStore: tokenStore.publicKey,
          transferTokenTo: userTokenAccount,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        },
        signers: [user],
      });

      const userBalance = (
        await anchor
          .getProvider()
          .connection.getTokenAccountBalance(userTokenAccount)
      ).value.amount;
      chai.assert.equal(
        userBalance,
        new anchor.BN((i + 1) * 10 * anchor.web3.LAMPORTS_PER_SOL).toString()
      );
    }
  });

  it('Can close promise and treasury', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);
    const rentCollector = new anchor.web3.Keypair();
    const [tokenStoreAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
        program.programId
      );

    for (let i = 0; i < 2; i++) {
      const user = new anchor.web3.Keypair();

      await createPromise(
        adminAuthority,
        treasury.publicKey,
        tokenStore.publicKey,
        user.publicKey
      );
    }
    const allPromises = await program.account.promise.all(
      Buffer.from(treasury.publicKey.toBytes())
    );
    for (const {publicKey} of allPromises) {
      await program.rpc.closePromise({
        accounts: {
          promiseAccount: publicKey,
          treasuryAccount: treasury.publicKey,
          adminAuthority: adminAuthority.publicKey,
          rentCollector: rentCollector.publicKey,
        },
        signers: [adminAuthority],
      });
    }
    await program.rpc.closeTreasury({
      accounts: {
        treasuryAccount: treasury.publicKey,
        adminAuthority: adminAuthority.publicKey,
        tokenAuthority: tokenStoreAuthority,
        tokenStore: tokenStore.publicKey,
        transferTokenTo: myMndeAccount,
        rentCollector: rentCollector.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
      signers: [adminAuthority],
    });
  });

  it('It can set admin', async () => {
    const adminAuthority = new anchor.web3.Keypair();
    const treasury = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();
    const rentCollector = new anchor.web3.Keypair();
    await createTreasury(adminAuthority, treasury, tokenStore);

    const [tokenStoreAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new TextEncoder().encode('treasury'), treasury.publicKey.toBytes()],
        program.programId
      );

    const newAdminAuthority = new anchor.web3.Keypair();
    program.rpc.setAdmin(newAdminAuthority.publicKey, {
      accounts: {
        treasuryAccount: treasury.publicKey,
        adminAuthority: adminAuthority.publicKey,
      },
      signers: [adminAuthority],
    });

    try {
      await program.rpc.closeTreasury({
        accounts: {
          treasuryAccount: treasury.publicKey,
          adminAuthority: adminAuthority.publicKey,
          tokenAuthority: tokenStoreAuthority,
          tokenStore: tokenStore.publicKey,
          transferTokenTo: myMndeAccount,
          rentCollector: rentCollector.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        },
        signers: [adminAuthority],
      });
      chai.assert.fail('Admin must be changed');
    } catch (e) {
      // OK must be here
    }

    await program.rpc.closeTreasury({
      accounts: {
        treasuryAccount: treasury.publicKey,
        adminAuthority: newAdminAuthority.publicKey,
        tokenAuthority: tokenStoreAuthority,
        tokenStore: tokenStore.publicKey,
        transferTokenTo: myMndeAccount,
        rentCollector: rentCollector.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
      signers: [newAdminAuthority],
    });
  });
});
