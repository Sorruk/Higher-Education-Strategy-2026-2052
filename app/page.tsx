import { requireChatGPTUser } from './chatgpt-auth';
import Platform from './platform';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireChatGPTUser('/'); return <Platform/>; }
