import Image from 'next/image'

const tiles = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  src: '/hero-kids-science.png',
  alt: `Park photo ${i + 1}`,
}))

export default function Gallery() {
  return (
    <section id="gallery" className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {tiles.map(tile => (
            <div key={tile.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                className="object-cover"
                sizes="(max-width:768px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
