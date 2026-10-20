import { useEffect, useState } from "react";
import "./App.css";
import SalonExperience from "./experience/SalonExperience.jsx";
import BookingRequest from "./BookingRequest.jsx";

const navLinks = [
  ["#house", "The House"],
  ["#services", "Services"],
  ["#journal", "Journal"],
  ["#studio", "The Studio"],
];

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
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);

  // The navigation floats over the walkthrough, then turns solid once the
  // ivory pages below it reach the top of the screen.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const experience = document.getElementById("top");
      const bottom = experience ? experience.getBoundingClientRect().bottom : 0;
      setSolid(bottom < 72);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Mobile menu: Escape closes it, the page behind does not scroll
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMenu(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const closeMenu = () => setMenu(false);

  return (
    <div className="site">
      <header className={`nav ${solid ? "nav--solid" : ""} ${menu ? "nav--open" : ""}`}>
        <a href="#top" className="brand" onClick={closeMenu}>
          ELANE
        </a>

        <nav className="nav-links" aria-label="Primary">
          {navLinks.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>

        <div className="nav-end">
          <a href="#booking" className="nav-cta" onClick={closeMenu}>
            Book an appointment
          </a>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menu}
            aria-controls="mobile-nav"
            aria-label={menu ? "Close menu" : "Open menu"}
            onClick={() => setMenu((open) => !open)}
          >
            <i aria-hidden="true" />
          </button>
        </div>
      </header>

      <div id="mobile-nav" className={`mobile-nav ${menu ? "is-open" : ""}`} hidden={!menu}>
        <nav aria-label="Mobile">
          {navLinks.map(([href, label]) => (
            <a key={href} href={href} onClick={closeMenu}>
              {label}
            </a>
          ))}
          <a href="#booking" className="mobile-nav-cta" onClick={closeMenu}>
            Request an appointment <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <p>Golf Course Road, Gurugram · Mon — Sat, 10:00 — 20:00</p>
      </div>

      <main>
        {/* THE WALKTHROUGH (replaces the static hero; falls back to photography) */}
        <SalonExperience />

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
          <img loading="lazy" decoding="async" src="/Images/salon.jpg" alt="Elane beauty house interior" />
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
                  <img loading="lazy" decoding="async" src={service.image} alt={service.title} />
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
            <img loading="lazy" decoding="async" src="/Images/styling.jpg" alt="Elane styling experience" />
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
              <img loading="lazy" decoding="async" src={gallery[0]} alt="Beauty editorial portrait" />
            </div>

            <div className="gallery-item gallery-small">
              <img loading="lazy" decoding="async" src={gallery[1]} alt="Hair styling at Elane" />
            </div>

            <div className="gallery-item gallery-small">
              <img loading="lazy" decoding="async" src={gallery[2]} alt="Beauty detail" />
            </div>

            <div className="gallery-item gallery-wide">
              <img loading="lazy" decoding="async" src={gallery[3]} alt="Elane studio interior" />
            </div>
          </div>
        </section>

        {/* BRIDAL */}
        <section className="bridal">
          <img loading="lazy" decoding="async" src="/Images/bridal.jpg" alt="Elane bridal beauty" />

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
              Enquire about bridal <span>↗</span>
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
              <img loading="lazy" decoding="async" src="/Images/interior.jpg" alt="Elane studio" />
            </div>
          </div>
        </section>

        {/* BOOKING */}
        <section className="booking" id="booking">
          <div className="booking-image">
            <img loading="lazy" decoding="async" src="/Images/detail.jpg" alt="Elane beauty detail" />
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

            <BookingRequest />
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

        <p className="footer-disclaimer">
          Elane Beauty House is a fictional concept project by JynxBuilds. This demonstration does not represent a
          real salon or accept actual appointments.
        </p>

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