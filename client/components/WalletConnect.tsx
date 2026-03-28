"use client";

import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  ensureMonadTestnet,
  getMonBalance,
} from "@/lib/contract";

type Props = {
  onAddress?: (address: string | null) => void;
};

export function WalletConnect({ onAddress }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const b = await getMonBalance(addr);
      setBalance(parseFloat(b).toFixed(4));
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    onAddress?.(address);
  }, [address, onAddress]);

  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[];
      if (accs?.[0]) {
        setAddress(accs[0]);
        void refreshBalance(accs[0]);
      } else {
        setAddress(null);
        setBalance(null);
      }
    };
    const onChain = () => {
      if (address) void refreshBalance(address);
    };
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [address, refreshBalance]);

  const handleConnect = async () => {
    setError(null);
    setBusy(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      await refreshBalance(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async () => {
    setError(null);
    setBusy(true);
    try {
      await ensureMonadTestnet();
      if (address) await refreshBalance(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {!address ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="rounded border border-[#22ff66] bg-[#0d1a0f] px-4 py-2 text-sm font-bold tracking-wide text-[#22ff66] shadow-[0_0_12px_rgba(34,255,102,0.25)] transition hover:bg-[#142818] disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect Wallet"}
        </button>
      ) : (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="font-mono text-sm text-zinc-200">
            {address.slice(0, 6)}…{address.slice(-4)}
          </div>
          {balance !== null && (
            <div className="text-sm text-[#22ff66]">
              {balance} <span className="text-zinc-400">MON</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSwitch}
            disabled={busy}
            className="text-xs text-zinc-500 underline hover:text-zinc-300"
          >
            Monad Testnet
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
