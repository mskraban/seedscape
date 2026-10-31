# Security policy

Seedscape is a static site plus a small, stateless image API. It stores no user data and has no accounts.

If you find a security problem (for example a way to make the API use unbounded memory or time), please report it privately through GitHub's **Report a vulnerability** button under the repository's *Security* tab rather than a public issue. You will get a reply within a few days.

Known, intentional limits: images up to 4096 px per side and 8.5 megapixels, animations up to 48 frames and 13 megapixels in total, response bodies up to about 4.4 MB.
