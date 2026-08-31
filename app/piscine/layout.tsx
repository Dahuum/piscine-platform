import AIChat from '@/components/piscine/ai-chat'
import ScrollBar from '@/components/scroll-bar'

export default function PiscineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollBar />
      {children}
      <AIChat />
    </>
  )
}
