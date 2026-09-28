import type { Profile } from '../../types/database'
import { displayName, initials, personColor } from '../../lib/team'

interface Props {
  profile: Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | undefined | null
  size?: number
  ring?: boolean
  photo?: boolean
}

// One avatar everywhere: fixed circle, initials flex-centered and sized to fit two letters.
export function Avatar({ profile, size = 24, ring = false, photo = true }: Props) {
  const style = {
    width: size,
    height: size,
    outline: ring ? '2px solid #2563EB' : undefined,
    outlineOffset: ring ? 2 : undefined,
  }
  if (photo && profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        title={profile ? displayName(profile as Profile) : undefined}
        className="rounded-full object-cover shrink-0"
        style={style}
      />
    )
  }
  return (
    <span
      title={profile ? displayName(profile as Profile) : 'Unassigned'}
      className="inline-flex items-center justify-center rounded-full shrink-0 text-white font-bold select-none"
      style={{
        ...style,
        background: profile ? personColor(profile) : '#cbd5e1',
        fontSize: Math.round(size * 0.4),
        lineHeight: 1,
        letterSpacing: '0.02em',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {profile ? initials(profile) : '?'}
    </span>
  )
}
