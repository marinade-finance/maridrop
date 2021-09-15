const anchor = require('@project-serum/anchor');
// import { createAssociatedTokenAccount } from "@project-serum/associated-token";
const token = require('@solana/spl-token');

describe('maridrop', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  it('Is initialized!', async () => {
    // Add your test here.
    const program = anchor.workspace.Maridrop;
    const adminAuthority = new anchor.web3.Keypair();
    const treasuryKey = new anchor.web3.Keypair();

    const mndeMint = new anchor.web3.Keypair();
    const tokenStore = new anchor.web3.Keypair();

    const mintAccountSize = 82;
    const mintRent = await program.provider.connection.getMinimumBalanceForRentExemption(mintAccountSize);
    const tokenAccountSize = 165;
    const tokenRent = await program.provider.connection.getMinimumBalanceForRentExemption(tokenAccountSize);


    const transaction = new anchor.web3.Transaction({ feePayer: program.provider.wallet.publicKey });
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: mndeMint.publicKey,
        lamports: mintRent,
        space: mintAccountSize,
        programId: token.TOKEN_PROGRAM_ID,
      }),
    );

    transaction.add(
      token.Token.createInitMintInstruction(
        token.TOKEN_PROGRAM_ID,
        mndeMint.publicKey,
        9,
        program.provider.wallet.publicKey,
        null
      ),
    );

    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: tokenStore.publicKey,
        lamports: tokenRent,
        space: tokenAccountSize,
        programId: token.TOKEN_PROGRAM_ID,
      }),
    );
    const [tokenStoreAuthority, tokenStoreAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress([
        new TextEncoder().encode('treasury'), treasuryKey.publicKey.toBytes()],
        program.programId);
        console.log(`authority ${tokenStoreAuthority} ${tokenStoreAuthorityBump}`);

    transaction.add(token.Token.createInitAccountInstruction(
      token.TOKEN_PROGRAM_ID,
      mndeMint.publicKey,
      tokenStore.publicKey,
      tokenStoreAuthority
    ))
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: treasuryKey.publicKey,
        lamports: await program.provider.connection.getMinimumBalanceForRentExemption(1000),
        space: 1000,
        programId: program.programId,
      }),
    );

    transaction.add(await program.instruction.initTreasury(
      adminAuthority.publicKey, program.provider.wallet.publicKey, new anchor.BN(0), new anchor.BN(0), tokenStoreAuthorityBump, {
      accounts: {
        treasuryAccount: treasuryKey.publicKey,
        tokenStore: tokenStore.publicKey,
      },
    }));
    console.log("Tx: " + await program.provider.send(transaction, [treasuryKey, mndeMint, tokenStore]))
  });
});
