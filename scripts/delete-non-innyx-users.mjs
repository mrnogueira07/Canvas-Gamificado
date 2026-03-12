/**
 * Script: delete-non-innyx-users.mjs
 * 
 * Lista todos os usuários do Firebase Auth e exclui aqueles
 * cujo e-mail NÃO termina com @innyx.com
 * 
 * COMO USAR:
 *   1. Baixe o arquivo serviceAccount.json do Firebase Console:
 *      Firebase Console → Configurações do Projeto → Contas de Serviço → Gerar nova chave privada
 *   2. Salve o arquivo como: scripts/serviceAccount.json
 *   3. Execute: node scripts/delete-non-innyx-users.mjs
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'serviceAccount.json');

// Verifica se o arquivo de credenciais existe
let serviceAccount;
try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
} catch {
    console.error('\n❌ Arquivo serviceAccount.json não encontrado!');
    console.error('   Caminho esperado:', serviceAccountPath);
    console.error('\n📋 Para obter o arquivo:');
    console.error('   1. Acesse console.firebase.google.com');
    console.error('   2. Seu projeto → Configurações (⚙️) → Contas de Serviço');
    console.error('   3. Clique em "Gerar nova chave privada"');
    console.error('   4. Salve o JSON como: scripts/serviceAccount.json\n');
    process.exit(1);
}

// Inicializa o Firebase Admin
initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();
const adminDb = getFirestore();

const ALLOWED_DOMAIN = '@innyx.com';

async function deleteNonInnyx() {
    console.log('\n🔍 Buscando todos os usuários no Firebase Auth...\n');

    const toDelete = [];
    let nextPageToken;

    // Pagina por todos os usuários (Firebase retorna até 1000 por vez)
    do {
        const result = await adminAuth.listUsers(1000, nextPageToken);
        for (const user of result.users) {
            const email = user.email || '';
            if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
                toDelete.push({ uid: user.uid, email: email || '(sem e-mail)' });
            }
        }
        nextPageToken = result.pageToken;
    } while (nextPageToken);

    if (toDelete.length === 0) {
        console.log('✅ Nenhum usuário irregular encontrado. Todos os e-mails são @innyx.com!\n');
        return;
    }

    console.log(`⚠️  Encontrados ${toDelete.length} usuário(s) com e-mail fora do domínio @innyx.com:\n`);
    toDelete.forEach((u, i) => {
        console.log(`   ${i + 1}. [${u.uid}] → ${u.email}`);
    });

    console.log('\n🗑️  Iniciando exclusão...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const user of toDelete) {
        try {
            // Exclui do Firebase Auth
            await adminAuth.deleteUser(user.uid);

            // Tenta excluir também do Firestore (coleção "users")
            try {
                await adminDb.collection('users').doc(user.uid).delete();
            } catch {
                // Ignora se não existir no Firestore
            }

            console.log(`   ✅ Excluído: ${user.email}`);
            deletedCount++;
        } catch (err) {
            console.error(`   ❌ Erro ao excluir ${user.email}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n📊 Resultado:`);
    console.log(`   ✅ Excluídos com sucesso: ${deletedCount}`);
    if (errorCount > 0) console.log(`   ❌ Erros: ${errorCount}`);
    console.log();
}

deleteNonInnyx().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});