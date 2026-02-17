<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "--- Statistics Verification ---" . PHP_EOL;

// 1. Total Conversations
$totalConvs = DB::table('conversations')->count();
echo "Total Conversations (Actual DB Count): $totalConvs" . PHP_EOL;

// 2. Total Messages
$totalMsgs = DB::table('messages')->count();
echo "Total Messages (Actual DB Count): $totalMsgs" . PHP_EOL;

$sentMsgs = DB::table('messages')->where('is_from_user', 0)->count();
echo "Messages Sent (is_from_user=0): $sentMsgs" . PHP_EOL;

$receivedMsgs = DB::table('messages')->where('is_from_user', 1)->count();
echo "Messages Received (is_from_user=1): $receivedMsgs" . PHP_EOL;

// 3. Advisor Stats Logic Check
$advisor = DB::table('users')->where('role', 'advisor')->first();

if ($advisor) {
    echo PHP_EOL . "--- Advisor: {$advisor->name} (ID: {$advisor->id}) ---" . PHP_EOL;

    // A. Direct count of messages sent by this advisor (Correct Method)
    $directCount = DB::table('messages')
        ->where('sent_by', $advisor->id)
        ->count();
    echo "Direct Message Count (Correct): $directCount" . PHP_EOL;

    // B. Count based on current conversation assignment (Potentially Incorrect Logic in Controller)
    // The controller joins users -> conversations -> messages
    // This implies messages are only counted if the conversation is CURRENTLY assigned to the user
    $controllerLogicCount = DB::table('users as u')
        ->leftJoin('conversations as c', 'u.id', '=', 'c.assigned_to')
        ->leftJoin('messages as m', function($join) {
            $join->on('c.id', '=', 'm.conversation_id')
                 ->on('m.sent_by', '=', 'u.id'); // Using u.id directly in join condition
        })
        ->where('u.id', $advisor->id)
        ->where('m.is_from_user', 0)
        ->count('m.id');
    
    echo "Controller Logic Count (Only currently assigned chats): $controllerLogicCount" . PHP_EOL;

    if ($directCount !== $controllerLogicCount) {
        echo "!!! DISCREPANCY DETECTED !!! The controller logic undercounts messages." . PHP_EOL;
    } else {
        echo "Counts match (User might only chat in their assigned conversations)." . PHP_EOL;
    }
} else {
    echo "No advisors found to test." . PHP_EOL;
}
