// LabFlow Lite - Main Application JavaScript

document.addEventListener('DOMContentLoaded', () => {
    console.log('LabFlow Lite landing page initialized.');

    // Smooth scrolling for navigation anchor links (internal # hashes only)
    const navLinks = document.querySelectorAll('a[href^="#"]');
    const navbarCollapse = document.getElementById('navbarContent');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId && targetId !== '#') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();

                    // Close mobile navbar if open
                    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                        const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse) || new bootstrap.Collapse(navbarCollapse);
                        bsCollapse.hide();
                    }

                    // Smooth scroll to target element with offset for fixed navbar
                    const headerOffset = 80;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Subtle Scroll Reveal for Lifecycle Timeline & Asset Panel
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        document.querySelectorAll('.lifecycle-step-row, .asset-lifecycle-panel').forEach(el => {
            el.classList.add('reveal-on-scroll');
            revealObserver.observe(el);
        });
    }
});

// Toggle In-Place Conflicts Preview from Problem Section
function toggleProblemConflictsPreview() {
    const compactConflicts = document.getElementById('conflicts-compact-preview');
    const problemRow = document.getElementById('problem-conflicts-row');
    if (!compactConflicts || !problemRow) return;

    if (compactConflicts.classList.contains('d-none')) {
        compactConflicts.classList.remove('d-none');
        problemRow.classList.add('active');
    } else {
        compactConflicts.classList.add('d-none');
        problemRow.classList.remove('active');
    }
}
