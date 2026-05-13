export interface SedOptions {
  extended?: boolean;
  suppressDefault?: boolean;
}

interface SedProgram {
  commands: SedCommand[];
  labels: Map<string, number>;
  suppressDefault: boolean;
}

type Address =
  | { type: 'line'; line: number }
  | { type: 'last' }
  | { type: 'regex'; regex: string };

interface SedCommand {
  address1?: Address;
  address2?: Address;
  inRange?: boolean;
  negate: boolean;
  verb: string;
  text?: string;
  label?: string;
  regex?: string;
  replacement?: string;
  flags?: string;
  string1?: string;
  string2?: string;
  children?: SedCommand[];
}

interface SedRuntime {
  lines: string[];
  index: number;
  lineNumber: number;
  pattern: string;
  hold: string;
  output: string[];
  pending: string[];
  substituted: boolean;
  quit: boolean;
  deleted: boolean;
  restart: boolean;
  suppressDefault: boolean;
  extended: boolean;
}

interface ParseState {
  script: string;
  pos: number;
  extended: boolean;
}

export function runSed(script: string, input: string, options: SedOptions = {}): string {
  const program = parseSedProgram(script, options);
  const lines = splitInputLines(input);
  const runtime: SedRuntime = {
    lines,
    index: 0,
    lineNumber: 0,
    pattern: '',
    hold: '',
    output: [],
    pending: [],
    substituted: false,
    quit: false,
    deleted: false,
    restart: false,
    suppressDefault: program.suppressDefault,
    extended: options.extended ?? false,
  };

  while (runtime.index < runtime.lines.length && !runtime.quit) {
    runtime.pattern = runtime.lines[runtime.index] ?? '';
    runtime.index += 1;
    runtime.lineNumber += 1;
    runtime.substituted = false;
    runCycle(program, runtime);
  }

  return runtime.output.join('\n');
}

function parseSedProgram(script: string, options: SedOptions): SedProgram {
  const state: ParseState = { script, pos: 0, extended: options.extended ?? false };
  const suppressFromComment = script.startsWith('#n');
  const commands = parseCommandList(state, false);
  const labels = new Map<string, number>();
  collectLabels(commands, labels);

  return {
    commands,
    labels,
    suppressDefault: options.suppressDefault === true || suppressFromComment,
  };
}

function parseCommandList(state: ParseState, stopAtBrace: boolean): SedCommand[] {
  const commands: SedCommand[] = [];

  while (state.pos < state.script.length) {
    skipCommandSeparators(state);
    if (state.pos >= state.script.length) break;

    if (stopAtBrace && state.script[state.pos] === '}') {
      state.pos += 1;
      break;
    }

    const command = parseCommand(state);
    if (command) commands.push(command);
  }

  return commands;
}

function parseCommand(state: ParseState): SedCommand | null {
  const address1 = parseAddress(state);
  let address2: Address | undefined;
  skipBlanks(state);

  if (state.script[state.pos] === ',') {
    state.pos += 1;
    skipBlanks(state);
    address2 = parseAddress(state);
  }

  skipBlanks(state);
  let negate = false;
  if (state.script[state.pos] === '!') {
    negate = true;
    state.pos += 1;
    skipBlanks(state);
  }

  const verb = state.script[state.pos];
  if (!verb) return null;
  state.pos += 1;

  if (verb === '#') {
    readToLineEnd(state);
    return makeCommand(address1, address2, negate, verb);
  }

  if (verb === '{') {
    const children = parseCommandList(state, true);
    return makeCommand(address1, address2, negate, verb, { children });
  }

  if (verb === '}') {
    return null;
  }

  if (verb === 's') {
    const delimiter = state.script[state.pos];
    if (!delimiter || delimiter === '\\' || delimiter === '\n') {
      throw new Error('Invalid substitute delimiter');
    }
    state.pos += 1;
    const regex = readDelimited(state, delimiter);
    const replacement = readDelimited(state, delimiter);
    const flags = readCommandArgument(state).trim();
    validateSubstituteFlags(flags);
    return makeCommand(address1, address2, negate, verb, { regex, replacement, flags });
  }

  if (verb === 'y') {
    const delimiter = state.script[state.pos];
    if (!delimiter || delimiter === '\\' || delimiter === '\n') {
      throw new Error('Invalid transliterate delimiter');
    }
    state.pos += 1;
    const string1 = unescapeYString(readDelimited(state, delimiter), delimiter);
    const string2 = unescapeYString(readDelimited(state, delimiter), delimiter);
    if ([...string1].length !== [...string2].length || new Set([...string1]).size !== [...string1].length) {
      throw new Error('Invalid y command strings');
    }
    readCommandArgument(state);
    return makeCommand(address1, address2, negate, verb, { string1, string2 });
  }

  if (verb === ':' || verb === 'b' || verb === 't') {
    const label = readCommandArgument(state).trim();
    return makeCommand(address1, address2, negate, verb, { label });
  }

  if (verb === 'a' || verb === 'c' || verb === 'i') {
    let text = readTextArgument(state);
    if (text.startsWith('\\')) text = text.slice(1);
    return makeCommand(address1, address2, negate, verb, { text });
  }

  if (verb === 'r' || verb === 'w') {
    const text = readCommandArgument(state).trim();
    return makeCommand(address1, address2, negate, verb, { text });
  }

  readCommandArgument(state);
  return makeCommand(address1, address2, negate, verb);
}

function makeCommand(
  address1: Address | undefined,
  address2: Address | undefined,
  negate: boolean,
  verb: string,
  rest: Partial<SedCommand> = {}
): SedCommand {
  const command: SedCommand = { negate, verb, ...rest };
  if (address1 !== undefined) command.address1 = address1;
  if (address2 !== undefined) command.address2 = address2;
  return command;
}

function parseAddress(state: ParseState): Address | undefined {
  skipBlanks(state);
  const ch = state.script[state.pos];
  if (!ch) return undefined;

  if (isDigit(ch)) {
    let value = '';
    while (isDigit(state.script[state.pos] ?? '')) {
      value += state.script[state.pos];
      state.pos += 1;
    }
    return { type: 'line', line: Number(value) };
  }

  if (ch === '$') {
    state.pos += 1;
    return { type: 'last' };
  }

  if (ch === '/') {
    state.pos += 1;
    return { type: 'regex', regex: readDelimited(state, '/') };
  }

  if (ch === '\\') {
    state.pos += 1;
    const delimiter = state.script[state.pos];
    if (!delimiter || delimiter === '\\' || delimiter === '\n') {
      throw new Error('Invalid address delimiter');
    }
    state.pos += 1;
    return { type: 'regex', regex: readDelimited(state, delimiter) };
  }

  return undefined;
}

function runCycle(program: SedProgram, runtime: SedRuntime): void {
  do {
    runtime.deleted = false;
    runtime.restart = false;
    executeCommands(program.commands, program, runtime);
  } while (runtime.restart && !runtime.quit);

  if (!runtime.deleted && !runtime.quit && !runtime.suppressDefault) {
    emit(runtime, runtime.pattern);
  }
  flushPending(runtime);
}

function executeCommands(commands: SedCommand[], program: SedProgram, runtime: SedRuntime): void {
  for (let pc = 0; pc < commands.length && !runtime.quit && !runtime.deleted; pc += 1) {
    const command = commands[pc];
    if (!command || !commandSelected(command, runtime)) continue;

    switch (command.verb) {
      case '#':
      case '':
        break;
      case '{':
        executeCommands(command.children ?? [], program, runtime);
        break;
      case 'a':
        runtime.pending.push(command.text ?? '');
        break;
      case 'i':
        emit(runtime, command.text ?? '');
        break;
      case 'c':
        if (!command.address2 || isRangeEnding(command, runtime)) {
          emit(runtime, command.text ?? '');
        }
        runtime.deleted = true;
        break;
      case 'd':
        runtime.deleted = true;
        break;
      case 'D':
        runDeleteFirstLine(runtime);
        break;
      case 'g':
        runtime.pattern = runtime.hold;
        break;
      case 'G':
        runtime.pattern += `\n${runtime.hold}`;
        break;
      case 'h':
        runtime.hold = runtime.pattern;
        break;
      case 'H':
        runtime.hold += `\n${runtime.pattern}`;
        break;
      case 'l':
        emit(runtime, formatUnambiguous(runtime.pattern));
        break;
      case 'n':
        runNextLine(runtime);
        break;
      case 'N':
        runAppendNextLine(runtime);
        break;
      case 'p':
        emit(runtime, runtime.pattern);
        break;
      case 'P':
        emit(runtime, runtime.pattern.split('\n', 1)[0] ?? '');
        break;
      case 'q':
        if (!runtime.suppressDefault) emit(runtime, runtime.pattern);
        flushPending(runtime);
        runtime.quit = true;
        break;
      case 's':
        applySubstitute(runtime, command);
        break;
      case 't':
        if (runtime.substituted) {
          runtime.substituted = false;
          pc = branchTarget(command, program);
        }
        break;
      case 'b':
        pc = branchTarget(command, program);
        break;
      case 'w':
      case 'r':
        throw new Error(`${command.verb} command is not available in Telegram text mode`);
      case 'x':
        [runtime.pattern, runtime.hold] = [runtime.hold, runtime.pattern];
        break;
      case 'y':
        applyTransliterate(runtime, command);
        break;
      case ':':
        break;
      case '=':
        emit(runtime, String(runtime.lineNumber));
        break;
      default:
        throw new Error(`Unsupported sed command: ${command.verb}`);
    }
  }
}

function commandSelected(command: SedCommand, runtime: SedRuntime): boolean {
  let selected: boolean;
  if (!command.address1) {
    selected = true;
  } else if (command.address2) {
    if (command.inRange) {
      selected = true;
      if (addressMatches(command.address2, runtime)) command.inRange = false;
    } else if (addressMatches(command.address1, runtime)) {
      selected = true;
      if (!addressMatches(command.address2, runtime)) command.inRange = true;
    } else {
      selected = false;
    }
  } else {
    selected = addressMatches(command.address1, runtime);
  }

  return command.negate ? !selected : selected;
}

function addressMatches(address: Address, runtime: SedRuntime): boolean {
  if (address.type === 'line') return runtime.lineNumber === address.line;
  if (address.type === 'last') return runtime.index >= runtime.lines.length;
  const regex = compileSedRegex(address.regex, runtime.extended, '');
  return regex.test(runtime.pattern);
}

function isRangeEnding(command: SedCommand, runtime: SedRuntime): boolean {
  if (!command.address2) return true;
  return addressMatches(command.address2, runtime);
}

function applySubstitute(runtime: SedRuntime, command: SedCommand): void {
  const flags = command.flags ?? '';
  const numeric = flags.match(/\d+/)?.[0];
  const occurrence = numeric ? Number(numeric) : undefined;
  const global = flags.includes('g') && occurrence === undefined;
  const regexFlags = `${flags.includes('i') ? 'i' : ''}${global || occurrence !== undefined ? 'g' : ''}`;
  const regex = compileSedRegex(command.regex ?? '', runtime.extended, regexFlags);
  let seen = 0;
  let changed = false;
  const replacement = command.replacement ?? '';

  runtime.pattern = runtime.pattern.replace(regex, (...args: unknown[]) => {
    const match = String(args[0]);
    const captures = args.slice(1, -2).map((capture) => (capture === undefined ? '' : String(capture)));
    seen += 1;
    if (occurrence !== undefined && seen !== occurrence) return match;
    changed = true;
    return expandReplacement(replacement, match, captures);
  });

  if (changed) {
    runtime.substituted = true;
    if (flags.includes('p')) emit(runtime, runtime.pattern);
    if (/\bw\b/.test(flags)) {
      throw new Error('s///w is not available in Telegram text mode');
    }
  }
}

function applyTransliterate(runtime: SedRuntime, command: SedCommand): void {
  const from = [...(command.string1 ?? '')];
  const to = [...(command.string2 ?? '')];
  const table = new Map<string, string>();
  from.forEach((char, index) => table.set(char, to[index] ?? ''));
  runtime.pattern = [...runtime.pattern].map((char) => table.get(char) ?? char).join('');
}

function runDeleteFirstLine(runtime: SedRuntime): void {
  const newline = runtime.pattern.indexOf('\n');
  if (newline === -1) {
    runtime.deleted = true;
    return;
  }
  runtime.pattern = runtime.pattern.slice(newline + 1);
  runtime.restart = true;
}

function runNextLine(runtime: SedRuntime): void {
  if (!runtime.suppressDefault) emit(runtime, runtime.pattern);
  flushPending(runtime);
  if (runtime.index >= runtime.lines.length) {
    runtime.deleted = true;
    runtime.quit = true;
    return;
  }
  runtime.pattern = runtime.lines[runtime.index] ?? '';
  runtime.index += 1;
  runtime.lineNumber += 1;
  runtime.substituted = false;
}

function runAppendNextLine(runtime: SedRuntime): void {
  if (runtime.index >= runtime.lines.length) {
    runtime.deleted = true;
    runtime.quit = true;
    return;
  }
  runtime.pattern += `\n${runtime.lines[runtime.index] ?? ''}`;
  runtime.index += 1;
  runtime.lineNumber += 1;
}

function branchTarget(command: SedCommand, program: SedProgram): number {
  const label = command.label ?? '';
  if (!label) return program.commands.length;
  const target = program.labels.get(label);
  if (target === undefined) throw new Error(`Undefined label: ${label}`);
  return target;
}

function collectLabels(commands: SedCommand[], labels: Map<string, number>): void {
  commands.forEach((command, index) => {
    if (command.verb === ':' && command.label !== undefined) labels.set(command.label, index);
    if (command.children) collectLabels(command.children, labels);
  });
}

function compileSedRegex(pattern: string, extended: boolean, flags: string): RegExp {
  const translated = translatePosixRegex(pattern, extended);
  return new RegExp(translated, flags);
}

function translatePosixRegex(pattern: string, extended: boolean): string {
  let translated = pattern
    .replace(/\[\[:alnum:\]\]/g, '[A-Za-z0-9]')
    .replace(/\[\[:alpha:\]\]/g, '[A-Za-z]')
    .replace(/\[\[:blank:\]\]/g, '[ \\t]')
    .replace(/\[\[:cntrl:\]\]/g, '[\\x00-\\x1F\\x7F]')
    .replace(/\[\[:digit:\]\]/g, '[0-9]')
    .replace(/\[\[:graph:\]\]/g, '[!-~]')
    .replace(/\[\[:lower:\]\]/g, '[a-z]')
    .replace(/\[\[:print:\]\]/g, '[ -~]')
    .replace(/\[\[:punct:\]\]/g, '[!-/:-@[-`{-~]')
    .replace(/\[\[:space:\]\]/g, '[ \\t\\r\\n\\f\\v]')
    .replace(/\[\[:upper:\]\]/g, '[A-Z]')
    .replace(/\[\[:xdigit:\]\]/g, '[A-Fa-f0-9]');

  translated = translated.replace(/\\n/g, '\n');

  if (!extended) {
    translated = translated
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\{/g, '{')
      .replace(/\\\}/g, '}')
      .replace(/(?<!\\)\+/g, '\\+')
      .replace(/(?<!\\)\?/g, '\\?')
      .replace(/(?<!\\)\|/g, '\\|');
  }

  return translated;
}

function expandReplacement(replacement: string, match: string, captures: string[]): string {
  let result = '';
  for (let index = 0; index < replacement.length; index += 1) {
    const ch = replacement[index];
    if (ch === '&') {
      result += match;
      continue;
    }
    if (ch === '\\') {
      const next = replacement[index + 1];
      if (next === undefined) {
        result += '\\';
      } else if (isDigit(next)) {
        result += captures[Number(next) - 1] ?? '';
        index += 1;
      } else if (next === 'n') {
        result += '\n';
        index += 1;
      } else {
        result += next;
        index += 1;
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function formatUnambiguous(text: string): string {
  const escaped = [...text]
    .map((char) => {
      switch (char) {
        case '\\':
          return '\\\\';
        case '\a':
          return '\\a';
        case '\b':
          return '\\b';
        case '\f':
          return '\\f';
        case '\r':
          return '\\r';
        case '\t':
          return '\\t';
        case '\v':
          return '\\v';
        case '\n':
          return '\\n';
        default: {
          const code = char.charCodeAt(0);
          if (code < 32 || code === 127) return `\\${code.toString(8).padStart(3, '0')}`;
          return char;
        }
      }
    })
    .join('');
  return `${escaped}$`;
}

function validateSubstituteFlags(flags: string): void {
  const compact = flags.replace(/\s+w\s+.+$/, 'w');
  if (/[^0-9gipw\s]/.test(compact)) {
    throw new Error('Unsupported substitute flags. POSIX flags are g, i, p, w, or a number');
  }
}

function readDelimited(state: ParseState, delimiter: string): string {
  let value = '';
  let escaped = false;
  let inBracket = false;

  while (state.pos < state.script.length) {
    const ch = state.script[state.pos] ?? '';
    state.pos += 1;

    if (escaped) {
      value += `\\${ch}`;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '[') inBracket = true;
    if (ch === ']' && inBracket) inBracket = false;

    if (ch === delimiter && !inBracket) return value;
    value += ch;
  }

  throw new Error(`Unterminated delimiter: ${delimiter}`);
}

function readCommandArgument(state: ParseState): string {
  let value = '';
  while (state.pos < state.script.length) {
    const ch = state.script[state.pos] ?? '';
    if (ch === '\n' || ch === ';') break;
    value += ch;
    state.pos += 1;
  }
  return value;
}

function readTextArgument(state: ParseState): string {
  let value = readCommandArgument(state).trimStart();
  if (value === '\\' && state.script[state.pos] === '\n') {
    state.pos += 1;
    value = readToLineEnd(state);
  }
  return value;
}

function readToLineEnd(state: ParseState): string {
  let value = '';
  while (state.pos < state.script.length) {
    const ch = state.script[state.pos] ?? '';
    if (ch === '\n') break;
    value += ch;
    state.pos += 1;
  }
  return value;
}

function skipCommandSeparators(state: ParseState): void {
  while (state.pos < state.script.length) {
    const ch = state.script[state.pos];
    if (ch === '\n' || ch === ';') {
      state.pos += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      state.pos += 1;
      continue;
    }
    break;
  }
}

function skipBlanks(state: ParseState): void {
  while (state.script[state.pos] === ' ' || state.script[state.pos] === '\t') {
    state.pos += 1;
  }
}

function splitInputLines(input: string): string[] {
  const normalized = input.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function emit(runtime: SedRuntime, text: string): void {
  runtime.output.push(text);
}

function flushPending(runtime: SedRuntime): void {
  for (const text of runtime.pending) emit(runtime, text);
  runtime.pending = [];
}

function unescapeYString(value: string, delimiter: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index];
    if (ch === '\\') {
      const next = value[index + 1];
      if (next === 'n') {
        result += '\n';
        index += 1;
      } else if (next === '\\' || next === delimiter) {
        result += next;
        index += 1;
      } else {
        result += next ?? '';
        index += 1;
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function isDigit(value: string): boolean {
  return value >= '0' && value <= '9';
}
