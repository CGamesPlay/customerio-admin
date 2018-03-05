# Customer.io Administrative API

Dear customer.io,

Please build an API to allow me to clone campaigns and other administrative
actions. Or at least build a UI to do it.

# Usage

Edit `credentials.js` to look like this:

```
// Get this by logging into customer.io, inspecting one of the XHRs, and copying
// the token from the "Authorization" header.
export const bearerToken = "...";
// Get this by looking at the URL: https://fly.customer.io/env/XXXXX/campaigns
export const environmentId = "XXXXX";
```

This isn't actually an API, just a one-off script. So it's pretty hard-coded at
the moment, but look at the exports of `api.js` to see what's available and
modify `index.js` to do what you want. Then run it:

```
yarn
babel-node index.js
```
