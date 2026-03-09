import Hero from "./components/pages/homes/hero";

export default function Home() {
  return (
    <>
      <Hero />

      <section className="bg-background py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-secondary mb-4 text-sm font-medium tracking-widest uppercase">
            Our Philosophy
          </p>
          <h2 className="text-primary text-4xl md:text-5xl">
            Reconnect with your inner balance
          </h2>
          <p className="text-muted mt-6 text-lg leading-relaxed">
            At Essentia, we believe true wellness begins when the body finds
            harmony with the mind. Every session is crafted to restore your
            natural equilibrium through expert touch and intentional care.
          </p>
        </div>
      </section>

      <section className="bg-cream-dark py-32">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-3">
          {[
            {
              title: "Deep Tissue",
              description:
                "Targeted pressure to release chronic tension and restore mobility in deep muscle layers.",
            },
            {
              title: "Hot Stone",
              description:
                "Heated basalt stones melt away stress while promoting deep circulation and calm.",
            },
            {
              title: "Aromatherapy",
              description:
                "Essential oils combined with gentle techniques to uplift the senses and soothe the spirit.",
            },
          ].map((service) => (
            <div key={service.title} className="text-center">
              <h3 className="text-primary text-2xl">{service.title}</h3>
              <p className="text-muted mt-4 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary py-32 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl text-white md:text-5xl">
            Begin your journey
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            Book your first session today and experience the Essentia
            difference. Your body will thank you.
          </p>
        </div>
      </section>
    </>
  );
}
