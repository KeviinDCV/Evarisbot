<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use Illuminate\Console\Command;

class UpdateContactNames extends Command
{
    protected $signature = 'conversations:update-names';
    protected $description = 'Update contact names to "Sin nombre" if they are null';

    public function handle()
    {
        $updated = Conversation::whereNull('contact_name')
            ->orWhere('contact_name', '')
            ->update(['contact_name' => 'Sin nombre']);

        $this->info("Updated {$updated} conversations");
        
        return 0;
    }
}
