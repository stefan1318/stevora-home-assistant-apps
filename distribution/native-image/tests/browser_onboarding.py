"""Browser acceptance for native onboarding with simulated Core REST and WebSocket responses."""
from pathlib import Path
from shutil import which
import json
from playwright.sync_api import sync_playwright, expect
root=Path('distribution/native-image/web')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"),args=['--no-sandbox'])
 ctx=browser.new_context(locale='en-US')
 page=ctx.new_page()
 done=set()
 events=[]
 failed=[True]
 def route(r):
  req=r.request; path=req.url.split('stevora.test')[1].split('?')[0]
  def reply(x,status=200): r.fulfill(status=status,json=x)
  if path=='/api/onboarding':
   if failed and failed.pop(): return reply({},503)
   return reply([dict(step=k,done=k in done) for k in ('user','core_config','analytics','integration')])
  if path.startswith('/api/onboarding/'):
   key=path.split('/')[-1]
   if key=='users':
    assert 'user' not in done and req.post_data_json['name']=='Owner'
    done.add('user');return reply({'auth_code':'test-code'})
   assert req.headers.get('authorization')=='Bearer mock-access'
   done.add(key);return reply({})
  if path=='/auth/token': return reply(dict(access_token='mock-access',refresh_token='mock-refresh',expires_in=1800))
  if path=='/auth/providers':return reply([])
  f=root/(path.lstrip('/') or 'index.html')
  if f.is_file():return r.fulfill(path=str(f.resolve()))
  reply({},404)
 page.route('https://stevora.test/**',route)
 def ws(sock):
  sock.send(json.dumps({'type':'auth_required'}))
  def msg(raw):
   m=json.loads(raw); typ=m['type']
   if typ=='auth':return sock.send(json.dumps({'type':'auth_ok','ha_version':'test'}))
   events.append(m)
   vals={'get_config':dict(location_name='Home',latitude=42,longitude=25,time_zone='Europe/Sofia'),'stevora/os/v1/manifest':dict(installation_id='test',entities=[],rooms=[]),'conversation/agent/list':{'agents':[]}}
   sock.send(json.dumps(dict(id=m['id'],type='result',success=True,result=vals.get(typ,[]))))
  sock.on_message(msg)
 page.route_web_socket('**/api/websocket',ws)
 page.goto('https://stevora.test/')
 expect(page.get_by_role('heading',name='Preparing STEVORA OS')).to_be_visible()
 page.get_by_label('Display name').fill('Owner',timeout=15000)
 page.get_by_label('Username').fill('owner')
 page.get_by_label('Password',exact=True).fill('test-only-one')
 page.get_by_label('Confirm password').fill('wrong')
 page.get_by_role('button',name='Create account').click()
 expect(page.get_by_role('alert')).to_contain_text('Passwords do not match')
 page.get_by_label('Confirm password').fill('test-only-one')
 page.get_by_role('button',name='Create account').click()
 expect(page.get_by_label('Home name')).to_be_visible()
 page.reload()
 page.get_by_label('Home name').fill('New home')
 page.get_by_role('button',name='Save home').click()
 page.get_by_role('button',name='Continue').click()
 page.get_by_role('button',name='Enter home').click()
 expect(page.locator('body')).not_to_have_class('setup-mode')
 assert done=={'user','core_config','analytics','integration'},done
 assert any(m['type']=='config/core/update' and m['location_name']=='New home' for m in events)
 assert any(m['type']=='analytics/preferences' and m['preferences']=={'base':False} for m in events)
 assert 'test-only-one' not in page.evaluate('JSON.stringify(sessionStorage)')
 page.evaluate('sessionStorage.clear()');page.reload()
 expect(page.get_by_role('button',name='Sign in to STEVORA')).to_be_visible()
 page.get_by_role('button',name='Change language').click()
 expect(page.get_by_role('button',name='Вход в STEVORA')).to_be_visible()
 print('PASS: Core unavailable, owner validation and creation, token exchange, authenticated resume, home configuration, privacy choice, manifest, home, existing-home login BG/EN')
 browser.close()
