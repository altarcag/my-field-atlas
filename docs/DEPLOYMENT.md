# Publish My Field Atlas

The GitHub repository is `altarcag/my-field-atlas`. Use **GitHub Actions for both deployments**; there is no need to connect a second Cloudflare Builds pipeline. The frontend and API stay in the same repository.

## 1. Add the Cloudflare identifiers to GitHub

Your existing resources should be:

- R2 Standard bucket: `my-field-atlas-files` (leave public access disabled).
- D1 database: `my-field-atlas-db`.

Find the **Account ID** in the Cloudflare dashboard and the **Database ID** on the D1 database's details page. These are identifiers, not passwords.

In GitHub open **Settings → Secrets and variables → Actions → Variables → New repository variable** and add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | The UUID of the existing `my-field-atlas-db` |

If you chose different resource names, update `wrangler.jsonc` before deploying.

## 2. Authorize automatic API deployment

In Cloudflare open your profile's **API Tokens** page and create a token using the **Edit Cloudflare Workers** template. Limit account resources to the account containing your bucket and database. Ensure it includes **Workers Scripts: Edit**, **D1: Edit**, **Workers R2 Storage: Edit**, and **Account Settings: Read** for that account. The template may include additional permissions for other Worker features; this project does not use custom-domain routes.

In GitHub open **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

- Name: `CLOUDFLARE_API_TOKEN`
- Value: the token you just created.

Store the token there, not in an issue, chat message, source file, or repository variable. It authorizes deployment, not visitor uploads.

## 3. Deploy the API

Open the repository's **Actions → Publish upload API → Run workflow**, choosing `main`.

The workflow installs dependencies, checks the code, applies database migrations to the existing database, and deploys **`my-field-atlas-api`**. It does not create a replacement bucket or database. The job is skipped until both identifier variables exist.

When it succeeds, find the Worker in Cloudflare **Workers & Pages**. Copy its actual `workers.dev` URL, for example:

`https://my-field-atlas-api.YOUR-SUBDOMAIN.workers.dev`

Visit that URL followed by `/api/health`. It should show JSON with `ok: true`. This checks the API process; `/api/projects` should return an empty projects list when the database is newly initialized.

If Cloudflare asks you to select a workers.dev subdomain, complete that one-time account step. A custom domain is optional.

## 4. Configure upload and owner passwords

In Cloudflare open **my-field-atlas-api → Settings → Variables and Secrets**. Add both entries using the **Secret** type:

| Secret | Purpose |
| --- | --- |
| `UPLOAD_PASSWORD` | Shared with trusted contributors for uploads and editing file metadata |
| `ADMIN_PASSWORD` | A different password kept by the owner; also permits deleting saved files and clearing unfinished uploads |

Use the upload password agreed for the project. Keep the owner password different: equal values do not grant owner access. Save/deploy the settings if the dashboard asks.

Both passwords are entered through the same Upload access form. There is no password-setting page in the website. Passwords remain in Cloudflare and are preserved by later code deployments.

## 5. Connect the frontend to the API

Return to GitHub **Settings → Secrets and variables → Actions → Variables** and add:

| Name | Value |
| --- | --- |
| `VITE_API_BASE_URL` | The actual HTTPS Worker origin, with no `/api` suffix, query string, or fragment |

This URL is public configuration and belongs in Variables, not Secrets. Never put either password in a `VITE_` variable: these values are bundled into the public website.

The API already allows browser requests from `https://altarcag.github.io`. The allowed Origin has no repository path. If the website later uses a different domain, update `ALLOWED_ORIGIN` in `wrangler.jsonc` and deploy the API again.

## 6. Publish GitHub Pages

In GitHub open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

Then open **Actions → Publish website → Run workflow** on `main`.

This workflow needs `VITE_API_BASE_URL`; it deliberately stops with an error if the API origin has not been configured. An early setup run may therefore fail until you complete step 5. Re-run it afterward.

On success, GitHub supplies the published address:

`https://altarcag.github.io/my-field-atlas/`

## 7. Check the complete workflow

1. Open the published site. Viewing the map should not ask for an upload password.
2. Try an incorrect upload password; it must be rejected.
3. Unlock with the shared password and create a project, such as URG-2026.
4. Upload a small intact KMZ with located photos, set the author, and save.
5. Add another KMZ or KML to the same project. Toggle individual files and the whole project.
6. Click the photo thumbnails and waypoint pins, and try all three map modes.
7. Reload to confirm the cloud data persists. Open a separate browser to confirm public viewing.
8. Lock uploads and unlock using the owner password to access file deletion.

The old prototype's data is not moved automatically. Re-upload the original files or arrange a separate transfer before retiring the prototype.

## Future changes

Push application changes to `main`. **Publish website** updates the frontend; **Publish upload API** updates the API when backend paths change. Review branches run checks without publishing. Both deployment workflows can also be started manually.

Changing a GitHub variable does not itself trigger a deployment: re-run the relevant workflow. Changing either Cloudflare password invalidates sessions issued using the old value.

Visitor uploads go to R2/D1 immediately and do not create commits or trigger builds. Code deployments preserve stored field data. Database changes must use new migrations rather than editing earlier migration files.

## Official references

- [GitHub Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Cloudflare deployments from GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 setup and bindings](https://developers.cloudflare.com/d1/get-started/)
- [R2 setup](https://developers.cloudflare.com/r2/get-started/)
