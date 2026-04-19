path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

# Find the closing bracket of the profiles array
insert_before = '\n];\n\n// ─── RUN CALIBRATION'

new_profiles = '''
  // ─── PERFILES ADICIONALES — cobertura extendida ───────────────────────────

  {
    id: "cal019",
    name: "ISO puro europeo — weak hand, bajo atletismo",
    note: "ISO scorer con baja atletismo, timing como creación, izquierda débil",
    inputs: {
      pos: "SF", hand: "R", ath: 2, phys: 3, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "medium", isoDir: "R", isoDec: "S",
      pnrFreq: "R", postFreq: "N",
      spotUpFreq: "S", deepRange: false,
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "weak",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      force_must: ["force_weak_hand"],
      force_must_not: ["force_contact"],
      deny_text_contains: ["right"],
      top_situations: ["iso_right"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal020",
    name: "DHO primario — giver + shooter",
    note: "DHO handler principal, da y recibe, spot-up secondary",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "secondary",
      selfCreation: "medium",
      dhoFreq: "P", dhoRole: "both", dhoAction: "shoot",
      spotUpFreq: "S", deepRange: true,
      isoFreq: "R", pnrFreq: "N", postFreq: "N",
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_dho"],
      deny_must_not: ["deny_post_entry", "deny_pnr_downhill"],
      force_must_not: ["force_trap", "force_early"],
      top_situations: ["dho"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal021",
    name: "Cutter primario — sin balón, acción compulsiva",
    note: "Cortador compulsivo, rol puro, sin tiro exterior",
    inputs: {
      pos: "SF", hand: "R", ath: 4, phys: 3, usage: "role",
      selfCreation: "low",
      cutFreq: "P", cutType: "backdoor",
      offBallRole: "cutter",
      freeCutsFrequency: "Primary", freeCutsType: "basket",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      spotUpFreq: "N", deepRange: false,
      transFreq: "S",
      vision: 3, orebThreat: "low",
      floater: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_cut_backdoor"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill", "deny_spot_deep"],
      force_must_not: ["force_early", "force_trap"],
      top_situations: ["cut"],
      danger_min: 1,
      danger_max: 3,
    },
  },

  {
    id: "cal022",
    name: "PnR Screener slip — ghost touch",
    note: "Screener que hace slip sistemático antes del contacto, PnR handler también",
    inputs: {
      pos: "PF", hand: "R", ath: 5, phys: 3, usage: "secondary",
      selfCreation: "medium",
      screenerAction: "slip", pnrScreenTiming: "ghost_touch",
      pnrFreq: "S",
      transFreq: "S", transRole: "rim_run",
      transFinishing: "high",
      spotUpFreq: "N", deepRange: false,
      isoFreq: "N", postFreq: "N",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "S", cutType: "basket",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_slip"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep"],
      force_must_not: ["force_early"],
      top_situations: ["pnr_screener"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal023",
    name: "Ball handling liability — turnovers under pressure",
    note: "Jugadora con manejo malo, full court pressure approach",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "medium",
      spotUpFreq: "S", deepRange: false,
      isoFreq: "R", pnrFreq: "N", postFreq: "N",
      transFreq: "R",
      vision: 2, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "liability", pressureResponse: "struggles",
    },
    expect: {
      force_must: ["force_no_ball"],
      allow_must_not: ["allow_iso"],
      danger_min: 1,
      danger_max: 3,
    },
  },

  {
    id: "cal024",
    name: "Ofensive rebounding specialist",
    note: "Oreb primario con putback primario, sin tiro, rol puro",
    inputs: {
      pos: "C", hand: "R", ath: 4, phys: 5, usage: "role",
      selfCreation: "low",
      orebThreat: "high", putbackQuality: "primary",
      postFreq: "R", postEntry: "duck_in",
      transFreq: "S", transRole: "rim_run",
      isoFreq: "N", pnrFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_oreb"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep", "deny_pnr_downhill"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      danger_min: 2,
      deny_text_contains: ["box"],
    },
  },

  {
    id: "cal025",
    name: "PnR Handler — asimetría forzar izquierda (force_direction)",
    note: "PnR handler hand=R con Drive por derecha y Pull-up por izquierda. Motor debe generar force_direction=L",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "pass",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      spotUpFreq: "S", deepRange: true,
      transFreq: "P", transRole: "fill", transRolePrimary: "pusher",
      transSubPrimary: "dribble_push",
      isoFreq: "N", postFreq: "N",
      vision: 5, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      force_must: ["force_direction"],
      force_must_not: ["force_early", "force_trap", "force_contact"],
      force_text_contains: ["left"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal026",
    name: "Floater primary threat — guard sin post",
    note: "Guard con floater primario en PnR, no hace post, usa el floater como finish principal",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Floater", pnrFinishRight: "Floater",
      floater: "P",
      isoFreq: "S", isoEff: "medium",
      spotUpFreq: "S", deepRange: true,
      postFreq: "N", transFreq: "S",
      vision: 4, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
      trapResponse: "escape",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry"],
      force_must_not: ["force_early", "force_trap"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
      danger_max: 5,
    },
  },

'''

if insert_before in content:
    content = content.replace(insert_before, new_profiles + insert_before)
    with open(path, 'w') as f:
        f.write(content)
    print('OK — 8 new profiles added')
else:
    print('NOT FOUND insert point')
    idx = content.find('];')
    print('first ]; at:', idx)
