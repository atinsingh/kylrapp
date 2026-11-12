import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { ConsumerPlan } from '@klyr/contracts';
import { color } from '@klyr/tokens';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';
import { Button, Card, Check, Chip, ErrorText, Field, Progress, Screen, sf, t, Title } from '../components/ui';
import { CodeEntry } from '../components/code-entry';

const PLANS: [ConsumerPlan, string, string][] = [
  ['buyer', 'Buy a home', '60–80% of the buyer commission back, the same whichever lender or lawyer you use'],
  ['seller', 'Sell a home', '$999 flat or 1% + HST, with a listing agreement and a licensed agent'],
  ['bundle', 'Sell and buy', 'One team for both sides, with closing dates planned together'],
  ['tenant', 'Rent a home', 'No fee to you. Move-in cost and rent-control status on every rental'],
  ['landlord', 'Lease out a home', 'Fixed fee, screened applicants and the Ontario Standard Lease'],
];
const AREAS = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const BUDGETS = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');

type Step = 'intent' | 'setup' | 'reco' | 'account' | 'code' | 'password';

export default function Start() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>('intent');
  const [plan, setPlan] = useState<ConsumerPlan>('buyer');
  const [areas, setAreas] = useState<string[]>(['Mississauga']);
  const [maxPrice, setMaxPrice] = useState(1_100_000);
  const [firstTime, setFirstTime] = useState(true);
  const [move, setMove] = useState({ address: '', mortgage: '', when: '', rent: '', moveIn: '' });
  const [acct, setAcct] = useState({ legalName: '', email: '', phone: '' });
  const [dealUpdates, setDealUpdates] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const buying = plan === 'buyer' || plan === 'bundle', selling = plan === 'seller' || plan === 'bundle';
  const toggleArea = (a: string) => setAreas(x => (x.includes(a) ? x.filter(y => y !== a) : [...x, a]));
  const progress = { intent: 1, setup: 2, reco: 3, account: 4, code: 4, password: 4 }[step];

  async function createAccount() {
    setError('');
    if (!terms || !privacy) return setError('Accept the terms and privacy notice to continue.');
    setBusy(true);
    const setup = buying ? { areas, maxPrice, firstTime, ...(selling ? move : {}) } : plan === 'tenant' ? { areas, ...move } : move;
    const r = await klyr.signup({ ...acct, phone: acct.phone || undefined, plan, setup, dealUpdates, marketing, acceptTerms: true, acceptPrivacy: true, recoGuideRead: true });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    auth.hold(true); // stay on this screen after the code so we can offer a password
    setStep('code');
  }

  async function finish(withPassword: boolean) {
    setError('');
    if (withPassword) {
      setBusy(true);
      const r = await klyr.setPassword(password);
      setBusy(false);
      if (!r.ok) return setError(errorText(r.error));
    }
    auth.hold(false);
    await auth.refresh();
  }

  return (
    <Screen>
      <Progress step={progress} />

      {step === 'intent' && (
        <>
          <Title sub="You can add another plan later from your profile.">What are you planning?</Title>
          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            {PLANS.map(([k, title, d]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: plan === k }} onPress={() => setPlan(k)}
                style={{ borderRadius: 18, padding: 16, gap: 3, backgroundColor: plan === k ? color.brand : color.surface }}>
                <Text style={{ ...sf(700), fontSize: 18, color: plan === k ? '#fff' : color.text }}>{title}</Text>
                <Text style={{ ...sf(), fontSize: 13, color: plan === k ? 'rgba(255,255,255,.85)' : color.textSecondary }}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="Continue" onPress={() => setStep('setup')} />
        </>
      )}

      {step === 'setup' && (
        <>
          <Title sub="Used to set up your home screen. Nothing is shared with anyone.">Tell us about your move</Title>
          {(buying || plan === 'tenant') && (
            <Card>
              <Text style={t.label}>{plan === 'tenant' ? 'WHERE YOU’D RENT' : 'WHERE YOU’D BUY'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{AREAS.map(a => <Chip key={a} label={a} on={areas.includes(a)} onPress={() => toggleArea(a)} />)}</View>
              {buying && (
                <>
                  <Text style={[t.label, { marginTop: 6 }]}>BUDGET</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{BUDGETS.map(v => <Chip key={v} label={`Up to ${short(v)}`} on={maxPrice === v} onPress={() => setMaxPrice(v)} />)}</View>
                  <Text style={[t.label, { marginTop: 6 }]}>FIRST HOME IN CANADA?</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Chip flex label="Yes" on={firstTime} onPress={() => setFirstTime(true)} />
                    <Chip flex label="No" on={!firstTime} onPress={() => setFirstTime(false)} />
                  </View>
                  <Text style={t.note}>First-time buyers get up to $4,000 back on Ontario land transfer tax, plus up to $4,475 in Toronto.</Text>
                </>
              )}
              {plan === 'tenant' && (
                <>
                  <Field label="Most you want to pay a month" value={move.rent} onChangeText={v => setMove({ ...move, rent: v })} keyboardType="number-pad" />
                  <Field label="Move-in" value={move.moveIn} onChangeText={v => setMove({ ...move, moveIn: v })} />
                </>
              )}
            </Card>
          )}
          {(selling || plan === 'landlord') && (
            <Card>
              <Text style={t.label}>{plan === 'landlord' ? 'HOME YOU’RE LEASING OUT' : 'HOME YOU’RE SELLING'}</Text>
              <Field label="Address" value={move.address} onChangeText={v => setMove({ ...move, address: v })} autoComplete="street-address" />
              {plan === 'landlord' ? (
                <>
                  <Field label="Rent you’re aiming for, a month" value={move.rent} onChangeText={v => setMove({ ...move, rent: v })} keyboardType="number-pad" />
                  <Field label="Available from" value={move.moveIn} onChangeText={v => setMove({ ...move, moveIn: v })} />
                </>
              ) : (
                <>
                  <Field label="Mortgage balance, roughly" value={move.mortgage} onChangeText={v => setMove({ ...move, mortgage: v })} keyboardType="number-pad" />
                  <Field label="When do you want to move?" value={move.when} onChangeText={v => setMove({ ...move, when: v })} />
                </>
              )}
            </Card>
          )}
          <Button title="Continue" onPress={() => setStep('reco')} />
        </>
      )}

      {step === 'reco' && (
        <>
          <Title sub="Ontario law requires a few things before an agent can work for you.">Before we give advice</Title>
          <Card>
            <Text style={sf(700)}>RECO Information Guide</Text>
            <Text style={t.note}>Explains being a client versus self-represented. 6 min read.</Text>
            <Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.reco.on.ca/')} style={{ ...sf(700), fontSize: 13, color: color.brand, textDecorationLine: 'underline' }}>Read the guide</Text>
            <Text style={{ ...sf(700), fontSize: 12, color: color.brand }}>● Rule · before any service</Text>
          </Card>
          <Card>
            <Text style={sf(700)}>Your representation agreement</Text>
            <Text style={t.note}>Form 300 to buy, Form 200 to sell, Form 346 to rent, Form 210 to lease out. You sign it before your first visit or listing, not now.</Text>
            <Text style={{ ...sf(700), fontSize: 12, color: color.brand }}>● Rule · before showings, offers or listing</Text>
          </Card>
          <Card>
            <Text style={sf(700)}>What to expect</Text>
            {['Until you sign, tips in the app are general information.', 'Cash back is paid on the commission Klyr actually receives.', 'Any fee Klyr earns from a lender, lawyer or insurer is shown on the quote.']
              .map(x => <Text key={x} style={{ ...t.body, fontSize: 13 }}>· {x}</Text>)}
          </Card>
          <Button title="I’ve read the guide" onPress={() => setStep('account')} />
        </>
      )}

      {step === 'account' && (
        <>
          <Title>Create your account</Title>
          <Card>
            <Field label="Full legal name" value={acct.legalName} onChangeText={v => setAcct({ ...acct, legalName: v })} autoComplete="name" textContentType="name" />
            <Field label="Email" value={acct.email} onChangeText={v => setAcct({ ...acct, email: v.trim() })} autoComplete="email" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
            <Field label="Mobile" value={acct.phone} onChangeText={v => setAcct({ ...acct, phone: v })} autoComplete="tel" keyboardType="phone-pad" textContentType="telephoneNumber" />
            <Text style={t.note}>Your legal name must match your ID. Klyr verifies ID once, before your first visit or listing, under federal FINTRAC rules.</Text>
          </Card>
          <Card>
            <Check on={dealUpdates} onPress={() => setDealUpdates(!dealUpdates)}>Send me deal updates by text and email</Check>
            <Check on={marketing} onPress={() => setMarketing(!marketing)}>Send me market news (optional)</Check>
            <Text style={t.note}>You can change these any time. Consent follows Canada’s anti-spam law.</Text>
          </Card>
          <Card>
            <Text style={t.label}>TERMS AND PRIVACY</Text>
            <Check on={terms} onPress={() => { setTerms(!terms); setError(''); }}>I agree to the Klyr Terms and the MLS® Virtual Office Website terms of use</Check>
            <Check on={privacy} onPress={() => { setPrivacy(!privacy); setError(''); }}>I have read the privacy notice</Check>
            <Text style={t.note}>We’ll send a 6-digit code to {acct.email || 'your email'}. Sold prices show only after your email is confirmed.</Text>
          </Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Create account" busy={busy} onPress={createAccount} />
        </>
      )}

      {step === 'code' && <CodeEntry email={acct.email} purpose="signup" onDone={() => setStep('password')} />}

      {step === 'password' && (
        <>
          <Title sub="At least 12 characters. A short sentence is easy to remember and hard to guess. You can add a passkey on the web.">Choose a password</Title>
          <Card><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" /></Card>
          <ErrorText>{error}</ErrorText>
          <Button title="Save password" busy={busy} disabled={password.length < 12} onPress={() => finish(true)} />
          <Button title="Skip for now, use email codes" alt onPress={() => finish(false)} />
        </>
      )}
    </Screen>
  );
}
