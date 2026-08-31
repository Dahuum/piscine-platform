import AIChat from '@/components/piscine/ai-chat'

export default function PiscineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AIChat />
    </>
  )
}
