/**
 * Sticks to the bottom of the viewport, so it stays visible while the page
 * content scrolls between it and the navbar.
 */
export function AppFooter() {
  return (
    <footer className="software-footer border-border bg-card border-t">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 text-center md:px-8">
        <p className="text-muted-foreground text-[13px]">
          Software Develop By:{" "}
          <a
            href="https://addsmint.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium transition-colors hover:underline"
          >
            AddsMint.com
          </a>
        </p>
      </div>
    </footer>
  );
}
