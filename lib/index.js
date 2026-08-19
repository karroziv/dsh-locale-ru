/**
 * Host half of the Russian language pack (no-op).
 *
 * This package is a client-only bundle: all behavior lives in `./client`
 * (the factory-form bundle served to the browser, which registers the `ru`
 * dictionaries). The Loader still mounts this entry as a host plugin row, so
 * the bare specifier (`"."`) must resolve to a module — hence this explicit
 * no-op `apply`. There is no server-side logic for a locale pack.
 * @module dsh-locale-ru
 */

/**
 * No-op host entry. The client half does the work.
 * @param ctx - host context (unused).
 */
export function apply(ctx) {
  void ctx
}
