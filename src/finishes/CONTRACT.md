# Native finishes

`NativeCatalog.load(object|path)` reads source-native binding version 1 at the pinned source revision, validates safe published texture paths/hashes/dimensions, known effects/UV modes, finite parameters and map references, and owns its unmodified snapshot. `require(surface)` rejects missing constructed identities; `resolve(surface)` returns the binding's own surface or its fixed fallback in `surfaceFallbacks` and rejects when neither exists. Its SHA-256 hashes UTF-8 JSON.stringify with property/array order retained and no newline. Native effects are interpreted and fully schema-validated by the renderer against the Materials public schema; this box creates no shaders or texture bytes.

Input: [NativeMaterialCatalog](../schema/native-materials.ts) or a JSON path. Output: owned binding snapshot, hash and required-surface validation. Depends on the [native Materials contract](../../../materials/sources/streets/scene-native/CONTRACT.md), Node IO and SHA-256.

Authored district maps and letter-atlas display and LED matrix surfaces resolve safe nested paths inside the theme asset tree. Display and `led-matrix` effects and optional solid emission parameters follow the Materials schema; source and authored provenance remain separate in the retained binding.
