import CoinToCashEngine from '@/components/CoinToCashEngine';

export const metadata = { title: 'Coin-to-Cash Engine demo' };

export default function CoinEngineDemoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
      <CoinToCashEngine className="w-full" size={1000} />
    </main>
  );
}
