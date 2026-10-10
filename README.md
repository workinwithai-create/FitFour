# FitFour

Four-bar instrument fit desk for bedroom producers and AI-music finishers.

You have a riff. The right chair is the one that finishes it. Suno and loop DAWs dump a pad under the progression. Session players try piano, nylon, upright, trumpet, violin, and kit until the loop sits. FitFour seats those chairs on the four chords you already have, plays bare vs fitted, and exports a DAW-ready loop.

Live samples only. FluidR3 acoustic grand, nylon guitar, upright bass, trumpet, violin, and acoustic kit from the PreEight sample bank, pinned to commit SHA. No oscillators. Audio never leaves the tab.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| TagFour | Four-bar last-line tag after the money chorus |
| ModEight | Last-chorus key change |
| LiftTwo | Two bars of climb into the hook |
| PreEight | Eight bars before the hook |
| AfterHook | Eight bars after the hook |
| EndEight | Last eight bars of the record |
| LastHook | Last chorus is the money chorus |
| **FitFour** | Four-bar instrument fit so a riff finally has a chair |

Yesterday's form desks write a section. FitFour does not write a pre, a tag, a lift, or a key change. It fits the live instrument to the loop you already have.

## Pricing recommendation

One-time **$29** on Lemon Squeezy, mirrored on Gumroad. Do not subscribe. Forge Pass stays the subscription for the cloud tools (AuraMix, MixForge, ReleaseForge). Sell where producers already buy one-shot utilities: Lemon Squeezy first, a Gumroad mirror, and a single post on r/WeAreTheMusicMakers.

The shipped app is free (MIT). No license gate. A priced build would need a Lemon Squeezy key check before it can be called a paid ship.

## Samples

Pinned commit SHA only.

* PreEight bank @d58301e4a494555f411a2afbc448b724136eee76

Branch tips are not allowed.

## License

MIT. workinwithai-create.

## Export acceptance

Default bounce is 48 kHz, 24-bit stereo. At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0. The offline render decodes the already-loaded ArrayBuffers into an OfflineAudioContext. It does not re-download. MIDI writes one track per chair with tempo and 4/4 set.

Permanent URL: https://fitfour.vercel.app

This desk is free. No checkout.
