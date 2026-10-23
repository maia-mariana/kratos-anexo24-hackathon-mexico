/**
 * Solana Devnet Anchoring (Memo program).
 * Dry-run default; Phantom wallet optional; never fake signatures.
 */

const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const DEVNET_URL = 'https://api.devnet.solana.com';

/**
 * Build memo instruction data.
 * @param {string} memo
 * @returns {Uint8Array}
 */
function buildMemoData(memo) {
  const encoder = new TextEncoder();
  return encoder.encode(memo);
}

/**
 * Dry-run anchor: returns memo and length.
 * @param {string} hash - 64-char hex
 * @param {string} eventId - e.g., INT-<12chars>
 * @returns {{dryRun: true, memo: string, memoLength: number}}
 */
export function anchorDryRun(hash, eventId) {
  const timestamp = new Date().toISOString();
  const memo = `IMMEX-SENTINEL|${eventId}|${hash}|${timestamp}`;
  return {
    dryRun: true,
    memo,
    memoLength: new TextEncoder().encode(memo).length
  };
}

/**
 * Anchor via Phantom wallet (client-side).
 * Requires Phantom provider injected as `window.solana`.
 * @param {string} hash
 * @param {string} eventId
 * @param {Object} wallet - Phantom wallet adapter (window.solana)
 * @returns {Promise<{dryRun: false, signature: string, explorerUrl: string} | {error: string}>}
 */
export async function anchorPhantom(hash, eventId, wallet) {
  if (!wallet || !wallet.publicKey || !wallet.signTransaction) {
    return { error: 'Phantom wallet not available or not connected' };
  }

  try {
    const { Connection, Transaction, TransactionInstruction, PublicKey } = await import(
      'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.0/+esm'
    );

    const connection = new Connection(DEVNET_URL, 'confirmed');
    const memoData = buildMemoData(`IMMEX-SENTINEL|${eventId}|${hash}|${new Date().toISOString()}`);

    const instruction = new TransactionInstruction({
      keys: [],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: memoData
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;

    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      dryRun: false,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    };
  } catch (e) {
    return { error: `Phantom anchor failed: ${e.message}` };
  }
}

/**
 * Unified anchor function.
 * @param {string} hash - 64-char hex
 * @param {string} eventId
 * @param {Object} opts - {mode: 'dry-run'|'phantom', wallet?}
 * @returns {Promise<AnchorResult>}
 */
export async function anchor(hash, eventId, opts = {}) {
  const { mode = 'dry-run', wallet } = opts;

  if (mode === 'dry-run') {
    return anchorDryRun(hash, eventId);
  }

  if (mode === 'phantom') {
    return anchorPhantom(hash, eventId, wallet);
  }

  return { error: `Unknown anchor mode: ${mode}` };
}