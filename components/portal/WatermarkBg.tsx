export default function WatermarkBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
        style={{ backgroundImage: "url('/hero-kids-science.png')" }}
      />
      <div className="absolute inset-0 bg-[#07132D]/92" />
    </div>
  )
}
