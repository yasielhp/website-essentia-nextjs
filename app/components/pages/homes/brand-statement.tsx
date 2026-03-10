import Image from "next/image";

export default function BrandStatement() {
  return (
    <section data-header-theme="light" className="text-primary">
      <div className="grid min-h-dvh w-full grid-cols-2 grid-rows-[180px_auto_auto_180px] md:grid-cols-5 md:grid-rows-5">
        {/* Img 1 — mobile: top-left / desktop: col-1 row-1-2 */}
        <div className="relative col-start-1 row-start-1 overflow-hidden md:row-span-2">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-1.webp"
            alt="Img 1"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 2 — mobile: top-right / desktop: col-1 row-3-5 */}
        <div className="relative col-start-2 row-start-1 overflow-hidden md:col-start-1 md:row-span-3 md:row-start-3">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-2.webp"
            alt="Img 2"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 3 — mobile: bottom-left / desktop: col-2-3 row-1 */}
        <div className="relative col-start-1 row-start-4 overflow-hidden md:col-span-2 md:col-start-2 md:row-span-1 md:row-start-1">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-3.webp"
            alt="Img 3"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 4 — desktop only: col-4-5 row-1 */}
        <div className="relative hidden overflow-hidden md:col-span-2 md:col-start-4 md:row-span-1 md:row-start-1 md:block">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-4.webp"
            alt="Img 4"
            fill
            className="object-cover"
          />
        </div>

        {/* CENTER CONTENT */}
        <div className="col-span-2 row-span-2 row-start-2 mx-auto flex w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center md:col-span-3 md:col-start-2 md:row-span-3 md:row-start-2 md:min-h-0 md:w-3/5 md:px-10">
          <p className="font-display text-3xl text-balance md:text-4xl lg:text-5xl">
            More than massage. A holistic journey.
          </p>
          <p className="text-muted leading-relaxed text-pretty">
            Essentia is more than a massage brand — it&apos;s a transformative
            experience combining wellness, exclusivity and personalization.
            Rooted in Tenerife, we integrate the serenity of the ocean and the
            luxury of the surroundings into a premium wellness proposal for
            residents and high-end tourists.
          </p>
        </div>

        {/* Img 5 — desktop only: col-5 row-2-5 */}
        <div className="relative hidden overflow-hidden md:col-start-5 md:row-span-4 md:row-start-2 md:block">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-5.webp"
            alt="Img 5"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 6 — mobile: bottom-right / desktop: col-2-4 row-5 */}
        <div className="relative col-start-2 row-start-4 overflow-hidden md:col-span-3 md:col-start-2 md:row-span-1 md:row-start-5">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-6.webp"
            alt="Img 6"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
