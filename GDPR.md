# Personuppgifter och radering i TaskBoard

Det här dokumentet beskriver projektets tekniska hantering av personuppgifter. Det är inte ett intyg om full GDPR-efterlevnad. En faktisk drift kräver även att den ansvariga verksamheten bestämmer ändamål, rättslig grund, kontaktväg och lagringstider.

## Uppgifter som sparas

| Data | Varför den finns |
|---|---|
| Namn, e-post, användar-ID och tidsstämplar | Konto, inloggning och samarbete |
| Lösenordshash | Kontroll av lösenord med bcrypt; inget klartextlösenord sparas |
| Global adminflagga, teamägare, medlemskap och teamroll | Behörighetskontroll |
| Tasks, tilldelad användare, deadline och prioritet | Planering inom teamet |
| Kommentarstext, författar-ID och tidpunkt | Kommunikation om en task |
| Aktivitetens händelsetyp, aktör-ID, task-ID och tidpunkt | Visa vad som hänt med en task |
| `deletedAt` | Visa att en resurs/konto tagits bort från vanlig användning |

Även ID:n och användarnas fritext kan vara personuppgifter. TaskBoard ber inte om personnummer eller särskilda kategorier av personuppgifter. Använd syntetiska uppgifter vid utveckling och test, och skriv inte känsliga personuppgifter i titlar, beskrivningar eller kommentarer.

## Skydd och åtkomst

Lösenord hashas med bcrypt och lösenordsfältet exponeras inte i API-svar. JWT gäller i en timme. Varje skyddad request verifierar token och hämtar det aktiva kontot från databasen. Ett borttaget konto kan därför inte använda en gammal token.

Teammedlemmar och projektägare har åtkomst inom sitt team. Global admin har bredare åtkomst för support. Registrering och profiluppdatering kan inte ge adminbehörighet. Adminrollen sätts genom ett betrott driftkommando. Zod och Mongoose validerar indata och egna felklasser ger klienten begripliga fel utan interna stacktraces.

Databasanslutning och JWT-nyckel finns i miljövariabler. Pino används för driftloggning; lösenord, token, hemligheter, request-body och användarnas fritext ska inte skrivas i loggen. Databasen är MongoDB Atlas när den miljön har konfigurerats. Den faktiska molnregionen, leverantörsavtalen, säkerhetskopiorna och åtkomsten i leverantörernas gränssnitt behöver hanteras av den som driver tjänsten.

## Tre olika slags borttagning

### Board, task, team, kolumn eller kommentar

`DELETE` mjukraderar genom att sätta `deletedAt`. Dokumentet, inklusive kommentarstext vid vanlig kommentarradering, finns kvar i MongoDB men döljs från vanliga API-anrop. Innehåll under en borttagen förälder blir också otillgängligt genom API:t. Mjukradering tar inte bort personuppgifter ur databasen och ska inte beskrivas som fullständig GDPR-radering.

### En användare tas bort från ett team

`DELETE /teams/:teamId/members/:userId` tar bort medlemskapet och användarens task-tilldelningar i just det teamet. Kontot kan användas i andra team. Tidigare kommentarer och aktivitet finns kvar med sina författar-/aktörskopplingar så att teamets historik inte förstörs.

Detta är borttagen åtkomst, inte radering av användarens konto eller alla personuppgifter. Projektägaren får inte tas bort med medlems-endpointen.

### Användaren rensar sitt konto

`DELETE /users/me` nekar med `409` om användaren fortfarande äger ett aktivt team. Ägarbyte är inte implementerat; ägaren behöver först mjukradera sitt team. När kontorensningen genomförs:

- `name` blir `Deleted user` och e-post ersätts med en slumpmässig adress under `example.invalid`.
- Lösenordet ersätts med hashen av ett nytt slumpmässigt värde som inte lämnas till användaren. Det tidigare lösenordet ersätts och kontot markeras som borttaget.
- `isAdmin` sätts till `false` och `deletedAt` sätts.
- Alla användarens medlemskap tas bort och alla task-tilldelningar till användaren blir `null`.
- Användarens kommentarer får `authorId: null` och texten `[deleted]`.
- Användarens aktivitet får `actorId: null`. Händelser, tidpunkter och detaljer utan användarfritext finns kvar. Detaljer om tidigare tilldelningar kan fortfarande innehålla användar-ID:n.

Kontodokumentet behålls i rensad form. Ett mjukraderat teams ägarreferens kan fortfarande peka på det rensade kontot. Rutinen är kontorensning/avidentifiering i API:ets databas och garanterar inte att allt kvarvarande material är anonymt i GDPR:s mening. Fritext i andra tasks eller andra användares kommentarer kan fortfarande identifiera någon och kan behöva granskas manuellt. Rutinen rensar inte automatiskt leverantörsloggar, tidigare exporter eller säkerhetskopior.

## Rättigheter och lagring

Användaren kan läsa och rätta sin profil via `GET/PATCH /users/me` och begära kontorensning med `DELETE /users/me`. Dessa endpoints är inte ett fullständigt flöde för registerutdrag, dataportabilitet eller alla andra rättigheter. Kompletterande begäranden behöver hanteras av den som driver tjänsten.

Projektet har ingen automatisk gallring, ingen fast beslutad lagringstid och inget automatiskt flöde för radering i säkerhetskopior. Driftansvarig behöver besluta och dokumentera gallring av inaktiva konton, mjukraderade dokument, historik, loggar och säkerhetskopior. IMY beskriver att personuppgifter ska begränsas till ändamålet och tas bort eller avidentifieras när de inte längre behövs. [IMY: grundläggande principer](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/grundlaggande-principer/).

En faktisk begäran om radering behöver bedömas i sitt sammanhang, inklusive eventuella skyldigheter att behålla vissa uppgifter. [IMY: rätt till radering](https://www.imy.se/privatperson/dataskydd/dina-rattigheter/radering/).

Före användning med riktiga personuppgifter behöver verksamheten fylla i ansvarig och kontaktväg, rättslig grund, valda driftregioner/biträden samt konkreta lagrings- och backuprutiner. Inga sådana uppgifter är påhittade i detta projektdokument.
