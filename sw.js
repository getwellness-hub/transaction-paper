const CACHE_NAME = "transaction-paper-v2";

const APP_FILES = [
  "./",
  "./manifest.json"
];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(
          cache =>
            cache.addAll(
              APP_FILES
            )
        )

    );

    self.skipWaiting();

  }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(
          keys =>
            Promise.all(

              keys
                .filter(
                  key =>
                    key !==
                    CACHE_NAME
                )

                .map(
                  key =>
                    caches.delete(
                      key
                    )
                )

            )
        )

    );

    self.clients.claim();

  }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
      Only handle GET requests.
    */

    if (
      request.method !==
      "GET"
    ) {

      return;

    }


    const url =
      new URL(
        request.url
      );


    /*
      Don't interfere with Firebase,
      Google, jsPDF CDN, Tailwind CDN
      or other external requests.
    */

    if (
      url.origin !==
      self.location.origin
    ) {

      return;

    }


    /*
      IMPORTANT:
      Always fetch the main HTML from network first.

      This ensures that when GitHub Pages has a
      new index.html, the browser gets the latest
      version instead of an old cached version.
    */

    const isHTML =
      request.mode === "navigate" ||
      url.pathname.endsWith("/index.html");


    if (
      isHTML
    ) {

      event.respondWith(

        fetch(request)

          .then(
            response => {

              /*
                Save latest HTML in cache
                for offline fallback.
              */

              const copy =
                response.clone();


              caches
                .open(
                  CACHE_NAME
                )
                .then(
                  cache =>
                    cache.put(
                      request,
                      copy
                    )
                );


              return response;

            }
          )

          .catch(
            () =>
              caches.match(
                request
              )
          )

      );

      return;

    }


    /*
      Other same-origin files:
      cache first, then network.
    */

    event.respondWith(

      caches
        .match(
          request
        )

        .then(
          cached => {

            if (
              cached
            ) {

              return cached;

            }


            return fetch(
              request
            )

              .then(
                response => {

                  const copy =
                    response.clone();


                  caches
                    .open(
                      CACHE_NAME
                    )

                    .then(
                      cache =>
                        cache.put(
                          request,
                          copy
                        )
                    );


                  return response;

                }
              )

          }
        )

    );

  }
);
