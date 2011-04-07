# == Schema Info
#
# Table name: subscriptions
#
#  id       :integer         not null, primary key
#  user_id  :integer
#  topic_id :integer

require 'test_helper'

class SubscriptionTest < ActiveSupport::TestCase
  fixtures :all
      
  def test_to_s
    s = Subscription.find(1)
    assert_equal s.to_s, '1'
  end
  
end
