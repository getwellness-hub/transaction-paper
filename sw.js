const CACHE_NAME = "transaction-paper-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json"
];


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


self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches.keys()
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


self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


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
      Google or external CDN requests.
    */

    if (
      url.origin !==
      self.location.origin
    ) {

      return;

    }


    event.respondWith(

      caches.match(
        request
      )
        .then(
          cached => {

            if (cached) {

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
              );

          }
        )

    );

  }
);
