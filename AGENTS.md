<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use Lovable Cloud with company-scoped RLS for operational records; this prevents cross-brokerage data leakage.
- Keep the first operational UI in protected routes and derive renewals from policy expiry; this avoids duplicate renewal records.
- Use a manifest-only PWA without a service worker; installation is needed but offline support was not requested.
