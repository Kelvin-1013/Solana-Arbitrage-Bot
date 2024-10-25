import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CpiSwapProgram } from "../target/types/cpi_swap_program";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("cpi-swap-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CpiSwapProgram as Program<CpiSwapProgram>;

  const RAYDIUM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
  const WHIRLPOOL_PROGRAM_ID = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

  let wallet: anchor.Wallet;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let sourceTokenAccount: PublicKey;
  let destinationTokenAccount: PublicKey;
  let whitelistAccount: Keypair;

  before(async () => {
    wallet = anchor.Wallet.local();
    whitelistAccount = Keypair.generate();

    await provider.connection.requestAirdrop(wallet.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    mintA = await createMint(provider.connection, wallet.payer, wallet.publicKey, null, 9);
    mintB = await createMint(provider.connection, wallet.payer, wallet.publicKey, null, 9);

    sourceTokenAccount = await createAccount(provider.connection, wallet.payer, mintA, wallet.publicKey);
    destinationTokenAccount = await createAccount(provider.connection, wallet.payer, mintB, wallet.publicKey);

    await mintTo(provider.connection, wallet.payer, mintA, sourceTokenAccount, wallet.payer, 1000000000);
  });

  it("Initializes the program", async () => {
    try {
      const tx = await  program.methods.initialize()
        .accounts({
          whitelist: whitelistAccount.publicKey,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitelistAccount])
        .rpc();

      console.log("Initialization Transaction Signature:", tx);
      assert.ok(tx, "Failed to initialize the program");

      const whitelistState = await program.account.whitelist.fetch(whitelistAccount.publicKey);
      assert.equal(whitelistState.authority.toBase58(), wallet.publicKey.toBase58(), "Authority not set correctly");
      assert.equal(whitelistState.users.length, 0, "Whitelist should be empty initially");
    } catch (err) {
      console.error("Error during initialization:", err);
      throw err;
    }
  });

  it("Manages whitelist", async () => {
    const addressToManage = Keypair.generate().publicKey;

    try {
      let tx = await program.methods.manageWhitelist(addressToManage, true)
        .accounts({
          authority: wallet.publicKey,
          whitelist: whitelistAccount.publicKey,
        }).signers([wallet.payer]).rpc();

      console.log("Add to Whitelist Transaction Signature:", tx);
      assert.ok(tx, "Failed to add to whitelist");

      let whitelistState = await program.account.whitelist.fetch(whitelistAccount.publicKey);
      assert.include(whitelistState.users.map(pub => pub.toBase58()), addressToManage.toBase58(), "Address not added to whitelist");

      tx = await program.methods.manageWhitelist(addressToManage, false)
        .accounts({
          authority: wallet.publicKey,
          whitelist: whitelistAccount.publicKey,
        }).signers([wallet.payer]).rpc();

      console.log("Remove from Whitelist Transaction Signature:", tx);
      assert.ok(tx, "Failed to remove from whitelist");

      whitelistState = await program.account.whitelist.fetch(whitelistAccount.publicKey);
      assert.notInclude(whitelistState.users.map(pub => pub.toBase58()), addressToManage.toBase58(), "Address not removed from whitelist");
    } catch (err) {
      console.error("Error managing whitelist:", err);
      throw err;
    }
  });

  it("Swaps on Raydium", async () => {
    const raydiumPoolAccounts = {
      ammId: new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"),
      ammAuthority: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      ammOpenOrders: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc"),
      ammTargetOrders: new PublicKey("CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR"),
      poolCoinTokenAccount: new PublicKey("DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz"),
      poolPcTokenAccount: new PublicKey("HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz"),
      serumProgramId: new PublicKey("9xQeWvG816bUx9EPGXSs8Bcw9EgoLkSLHkbGeas8erNZ"),
      serumMarket: new PublicKey("8Gmi2HhZmwQPVdCwzS7CM66MGstMXPcTVHA7jF19cLZz"),
      serumBids: new PublicKey("AuL9JzRJ55MdqzubK4EutJgAumtkuFcRVuPUvTX39pN8"),
      serumAsks: new PublicKey("8Lx9U9wdE3afdqih1mCAXy3unJDfzSaXFqAvoLMjhwoD"),
      serumEventQueue: new PublicKey("6o44a9xdzKKDNY7Ff2Qb129mktWbsCT4vKJcg2uk41uy"),
      serumCoinVaultAccount: new PublicKey("GGcdamvNDYFhAXr93DWyJ8QmwawUHLCyRqWL3KngtLRa"),
      serumPcVaultAccount: new PublicKey("22jHt5WmosAykp3LPGSAKgY45p7VGh4q3tC0VdE9KUes"),
      serumVaultSigner: new PublicKey("CzZmGm5bPKUy8RhxNpaAHuNC6LJHLvZJ3DYHGGKQegwk"),
    };

    try {
      await program.methods.manageWhitelist(wallet.publicKey, true)
        .accounts({
          authority: wallet.publicKey,
          whitelist: whitelistAccount.publicKey,
        }).signers([wallet.payer]).rpc();

      const balanceBefore = await getAccount(provider.connection, sourceTokenAccount);

      const tx = await program.methods.swapRaydium(
        new anchor.BN(1000000),
        new anchor.BN(500000)
      ).accounts({
        user: wallet.publicKey,
        whitelist: whitelistAccount.publicKey,
        userSourceToken: sourceTokenAccount,
        userDestinationToken: destinationTokenAccount,
        poolProgramId: RAYDIUM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        ...raydiumPoolAccounts,
      }).signers([wallet.payer]).rpc();

      console.log("Raydium Swap Transaction Signature:", tx);
      assert.ok(tx, "Failed to swap on Raydium");

      const balanceAfter = await getAccount(provider.connection, sourceTokenAccount);
      assert(balanceAfter.amount < balanceBefore.amount, "Token balance did not decrease after swap");
    } catch (err) {
      console.error("Error during Raydium swap:", err);
      throw err;
    }
  });

  it("Swaps on Whirlpool", async () => {
    const whirlpoolAccounts = {
      whirlpool: new PublicKey("HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ"),
      tokenVaultA: new PublicKey("3YQm7ujtXWJU2e9jhp2QGHpnn1ShXn12QjvzMvDgabpX"),
      tokenVaultB: new PublicKey("2JTw1fE2wz1SymWUQ7UqpVtrTuKjcd6mWwYwUJUCh2rq"),
      tickArray0: new PublicKey("2LSnWdbLv9NMKHp8pSpuy5KwNPbHeCFwUiKe6jtNHLhX"),
      tickArray1: new PublicKey("EE9AbRXbCKRGMeN6qAxxMUTEEPd1tQo67oYBQKkUNrfJ"),
      tickArray2: new PublicKey("5aGWvTWXuP7bGkiu9jVzGJ9irvwjLPHyXurfjsUNuoKi"),
      oracle: new PublicKey("HjMQnuxjVRWzc6q53j1eWxkpqwYQqr8vVqWbKwccpzPj"),
    };

    try {
      const balanceBefore = await getAccount(provider.connection, sourceTokenAccount);

      const tx = await program.methods.swapWhirlpool(
        new anchor.BN(1000000),
        new anchor.BN(500000),
        new anchor.BN(0),
        true,
        true
      ).accounts({
        user: wallet.publicKey,
        whitelist: whitelistAccount.publicKey,
        whirlpoolProgram: WHIRLPOOL_PROGRAM_ID,
        whirlpool: whirlpoolAccounts.whirlpool,
        tokenOwnerAccountA: sourceTokenAccount,
        tokenOwnerAccountB: destinationTokenAccount,
        tokenVaultA: whirlpoolAccounts.tokenVaultA,
        tokenVaultB: whirlpoolAccounts.tokenVaultB,
        tickArray0: whirlpoolAccounts.tickArray0,
        tickArray1: whirlpoolAccounts.tickArray1,
        tickArray2: whirlpoolAccounts.tickArray2,
        oracle: whirlpoolAccounts.oracle,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([wallet.payer]).rpc();

      console.log("Whirlpool Swap Transaction Signature:", tx);
      assert.ok(tx, "Failed to swap on Whirlpool");

      const balanceAfter = await getAccount(provider.connection, sourceTokenAccount);
      assert(balanceAfter.amount < balanceBefore.amount, "Token balance did not decrease after swap");
    } catch (err) {
      console.error("Error during Whirlpool swap:", err);
      throw err;
    }
  });
});