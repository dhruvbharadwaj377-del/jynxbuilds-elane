import "./App.css";

const services = [
  {
    number: "01",
    title: "Hair",
    text: "Precision cuts, colour, treatments and considered styling.",
    image: "/Images/hair.jpg",
  },
  {
    number: "02",
    title: "Skin",
    text: "Thoughtful rituals designed around the individual.",
    image: "/Images/skincare.jpg",
  },
  {
    number: "03",
    title: "Nails",
    text: "Quietly polished manicures and details that complete the look.",
    image: "/Images/nails.jpg",
  },
  {
    number: "04",
    title: "Bridal",
    text: "A considered beauty experience for the moments that matter.",
    image: "/Images/bridal.jpg",
  },
];

const gallery = [
  "/Images/portrait.jpg",
  "/Images/styling.jpg",
  "/Images/detail.jpg",
  "/Images/interior.jpg",
];

function App() {
  return (
    <div className="site">
      <header className="nav">
        <a href="#top" className="brand">
          ELANE
        </a>

        <nav className="nav-links">
          <a href="#house">The House</a>
          <a href="#services">Services</a>
          <a href="#journal">Journal</a>
          <a href="#studio">The Studio</a>
        </nav>

        <a href="#booking" className="nav-cta">
          Book an appointment
        </a>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <img
            src="/Images/hero.jpg"
            alt="Elane beauty editorial"
            className="hero-image"
          />

          <div className="hero-overlay" />

          <div className="hero-top">
            <span>Beauty House</span>
            <span>Gurugram · New Delhi</span>
          </div>

          <div className="hero-content">
            <p className="eyebrow">Est. 2026</p>
            <h1>
              Beauty,
              <br />
              refined.
            </h1>
            <p className="hero-copy">
              A modern beauty house shaped around individuality,
              intention and the art of feeling like yourself.
            </p>
            <a href="#services" className="text-link light-link">
              Explore Elane <span>↘</span>
            </a>
          </div>

          <div className="hero-bottom">
            <span>Scroll to discover</span>
            <span className="hero-line" />
          </div>
        </section>

        {/* INTRO */}
        <section className="intro" id="house">
          <div className="section-label">
            <span>01</span>
            <span>The House</span>
          </div>

          <div className="intro-grid">
            <h2>
              A quieter
              <br />
              approach to
              <br />
              beauty.
            </h2>

            <div className="intro-copy">
              <p className="large-copy">
                Elane is a contemporary beauty house where expert craft
                meets a slower, more personal way of getting ready.
              </p>

              <p>
                From the first consultation to the final detail, every
                experience is considered. Nothing excessive. Nothing
                rushed. Just exceptional work, thoughtfully delivered.
              </p>

              <a href="#studio" className="text-link">
                Discover the house <span>↗</span>
              </a>
            </div>
          </div>
        </section>

        {/* FULL IMAGE */}
        <section className="cinema">
          <img src="/Images/salon.jpg" alt="Elane beauty house interior" />
          <div className="cinema-caption">
            <span>01 / 04</span>
            <span>The Elane House</span>
          </div>
        </section>

        {/* SERVICES */}
        <section className="services" id="services">
          <div className="section-label">
            <span>02</span>
            <span>Services</span>
          </div>

          <div className="services-heading">
            <h2>
              Everything,
              <br />
              considered.
            </h2>

            <p>
              A focused collection of beauty services, delivered with
              precision and a distinctly personal touch.
            </p>
          </div>

          <div className="service-list">
            {services.map((service) => (
              <article className="service" key={service.number}>
                <div className="service-number">{service.number}</div>

                <div className="service-image">
                  <img src={service.image} alt={service.title} />
                </div>

                <div className="service-info">
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <span className="service-arrow">↗</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* STATEMENT */}
        <section className="statement">
          <div className="statement-image">
            <img src="/Images/styling.jpg" alt="Elane styling experience" />
          </div>

          <div className="statement-copy">
            <span className="mini-label">The Elane approach</span>

            <h2>
              You bring
              <br />
              the vision.
              <br />
              We refine it.
            </h2>

            <p>
              Beauty should never feel like a formula. Our stylists
              listen first, understand the individual, then create
              something that feels unmistakably yours.
            </p>

            <a href="#booking" className="text-link">
              Start your experience <span>↗</span>
            </a>
          </div>
        </section>

        {/* GALLERY */}
        <section className="journal" id="journal">
          <div className="section-label">
            <span>03</span>
            <span>Editorial</span>
          </div>

          <div className="journal-heading">
            <h2>
              The
              <br />
              Elane edit.
            </h2>

            <p>
              A glimpse into the people, spaces and details behind
              the house.
            </p>
          </div>

          <div className="gallery">
            <div className="gallery-item gallery-large">
              <img src={gallery[0]} alt="Beauty editorial portrait" />
            </div>

            <div className="gallery-item gallery-small">
              <img src={gallery[1]} alt="Hair styling at Elane" />
            </div>

            <div className="gallery-item gallery-small">
              <img src={gallery[2]} alt="Beauty detail" />
            </div>

            <div className="gallery-item gallery-wide">
              <img src={gallery[3]} alt="Elane studio interior" />
            </div>
          </div>
        </section>

        {/* BRIDAL */}
        <section className="bridal">
          <img src="/Images/bridal.jpg" alt="Elane bridal beauty" />

          <div className="bridal-overlay" />

          <div className="bridal-content">
            <span className="mini-label">Bridal at Elane</span>

            <h2>
              For the
              <br />
              moments
              <br />
              that matter.
            </h2>

            <p>
              From intimate ceremonies to the final photograph,
              a beauty experience designed around you.
            </p>

            <a href="#booking" className="text-link light-link">
              Explore bridal <span>↗</span>
            </a>
          </div>
        </section>

        {/* STUDIO */}
        <section className="studio" id="studio">
          <div className="section-label">
            <span>04</span>
            <span>The Studio</span>
          </div>

          <div className="studio-grid">
            <div className="studio-copy">
              <h2>
                Your place
                <br />
                to pause.
              </h2>

              <p>
                Designed as a calm counterpoint to the pace of the
                city, Elane is a space for expert beauty and a little
                time for yourself.
              </p>

              <div className="studio-details">
                <div>
                  <span>Location</span>
                  <strong>
                    Golf Course Road
                    <br />
                    Gurugram
                  </strong>
                </div>

                <div>
                  <span>Hours</span>
                  <strong>
                    Mon — Sat
                    <br />
                    10:00 — 20:00
                  </strong>
                </div>
              </div>

              <a href="#booking" className="text-link">
                Plan your visit <span>↗</span>
              </a>
            </div>

            <div className="studio-image">
              <img src="/Images/interior.jpg" alt="Elane studio" />
            </div>
          </div>
        </section>

        {/* BOOKING */}
        <section className="booking" id="booking">
          <div className="booking-image">
            <img src="/Images/detail.jpg" alt="Elane beauty detail" />
          </div>

          <div className="booking-content">
            <span className="mini-label">Your next chapter</span>

            <h2>
              Begin
              <br />
              here.
            </h2>

            <p>
              Tell us what you're looking for and we'll take it from
              there.
            </p>

            <a href="mailto:hello@elanebeautyhouse.com" className="booking-button">
              Make an appointment
              <span>↗</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">ELANE</div>

          <p>
            Beauty,
            <br />
            refined.
          </p>

          <div className="footer-links">
            <a href="#house">The House</a>
            <a href="#services">Services</a>
            <a href="#journal">Journal</a>
            <a href="#studio">The Studio</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Elane Beauty House</span>
          <span>Gurugram · New Delhi</span>
          <span>Instagram ↗</span>
        </div>
      </footer>
    </div>
  );
}

export default App;